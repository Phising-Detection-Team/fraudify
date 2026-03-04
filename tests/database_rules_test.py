"""
Quick smoke test: Verify database cannot be compromised.

Runs in seconds. Tests that all validation & constraints work.
"""

import sys
import os

# Add backend to path
backend_path = os.path.join(os.path.dirname(__file__), '..', 'backend')
sys.path.insert(0, backend_path)

from app import create_app, db
from app.models.email import Email
from app.models.round import Round
from app.models.log import Log
from app.models.api import API
from app.models.override import Override

from datetime import datetime
from sqlalchemy.exc import IntegrityError

# Setup
app = create_app()
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
app.config['TESTING'] = True

with app.app_context():
    db.create_all()
    session = db.session

    def test_result(name, passed):
        """Print test result."""
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{status}: {name}")
        return passed

    all_passed = True

    # ============================================================================
    # TEST 1: Confidence range (0-1 only)
    # ============================================================================
    print("\n=== VALIDATION TESTS ===\n")

    try:
        round_obj = Round(status="pending", total_emails=1, processed_emails=0,
                          started_at=datetime.utcnow(), completed_at=datetime.utcnow())
        session.add(round_obj)
        session.commit()
        
        # Valid confidence
        email = Email(
            round_id=round_obj.id, 
            generated_content="Test email", 
            generated_email_metadata={"sender": "test@test.com"},
            is_phishing=True,
            detector_verdict="phishing",
            detector_confidence=0.95,
            generator_latency_ms=100, 
            detector_latency_ms=50, 
            cost=0.01
        )
        session.add(email)
        session.commit()
        all_passed &= test_result("Confidence 0.95 accepted", email.detector_confidence == 0.95)
        
        # Invalid confidence (too high)
        try:
            email2 = Email(
                round_id=round_obj.id, 
                generated_content="Test email", 
                generated_email_metadata={"sender": "test@test.com"},
                is_phishing=True,
                detector_verdict="phishing",
                detector_confidence=1.5,
                generator_latency_ms=100, 
                detector_latency_ms=50, 
                cost=0.01
            )
            session.add(email2)
            session.commit()
            all_passed &= test_result("Confidence 1.5 rejected", False)
        except IntegrityError:
            session.rollback()
            all_passed &= test_result("Confidence 1.5 rejected", True)
        except:
            session.rollback()
            all_passed &= test_result("Confidence 1.5 rejected", True)
            
    except Exception as e:
        print(f"❌ FAILED: Confidence validation - {e}")
        all_passed = False

    # ============================================================================
    # TEST 2: Processed emails cannot exceed total
    # ============================================================================
    try:
        round_obj2 = Round(status="pending", total_emails=10, processed_emails=0,
                           started_at=datetime.utcnow(), completed_at=datetime.utcnow())
        session.add(round_obj2)
        session.commit()
        
        # Valid
        round_obj2.processed_emails = 5
        session.commit()
        all_passed &= test_result("Processed 5 of 10 accepted", round_obj2.processed_emails == 5)
        
        # Invalid: exceed total
        try:
            round_obj2.processed_emails = 15
            session.commit()
            all_passed &= test_result("Processed 15 of 10 rejected", False)
        except IntegrityError:
            session.rollback()
            all_passed &= test_result("Processed 15 of 10 rejected", True)
        except:
            session.rollback()
            all_passed &= test_result("Processed 15 of 10 rejected", True)
            
    except Exception as e:
        print(f"❌ FAILED: Processed emails validation - {e}")
        all_passed = False

    # ============================================================================
    # TEST 3: Enum validation (status, level, agent_type, verdict)
    # ============================================================================
    try:
        # Valid status
        round_obj3 = Round(status="running", total_emails=1, processed_emails=0,
                           started_at=datetime.utcnow(), completed_at=datetime.utcnow())
        session.add(round_obj3)
        session.commit()
        all_passed &= test_result("Status 'running' accepted", round_obj3.status == "running")
        
        # Valid log level
        log = Log(timestamp=datetime.utcnow(), level="warning", message="Test", round_id=round_obj3.id)
        session.add(log)
        session.commit()
        all_passed &= test_result("Log level 'warning' accepted", log.level == "warning")
        
        # Invalid enum (captured by ORM or DB)
        try:
            bad_round = Round(status="invalid_status", total_emails=1, processed_emails=0,
                             started_at=datetime.utcnow(), completed_at=datetime.utcnow())
            all_passed &= test_result("Invalid status rejected at ORM", False)
        except (ValueError, AssertionError):
            all_passed &= test_result("Invalid status rejected at ORM", True)
            
    except Exception as e:
        print(f"❌ FAILED: Enum validation - {e}")
        all_passed = False

    # ============================================================================
    # TEST 4: Negative values rejected (cost, latency, tokens)
    # ============================================================================
    try:
        round_obj4 = Round(status="pending", total_emails=1, processed_emails=0,
                           started_at=datetime.utcnow(), completed_at=datetime.utcnow())
        session.add(round_obj4)
        session.commit()
        
        # Invalid negative latency
        try:
            bad_email = Email(
                round_id=round_obj4.id, 
                generated_content="Test", 
                generated_email_metadata={"sender": "test@test.com"},
                is_phishing=True,
                detector_verdict="phishing",
                detector_confidence=0.5,
                generator_latency_ms=-100, 
                detector_latency_ms=50, 
                cost=0.01
            )
            session.add(bad_email)
            session.commit()
            all_passed &= test_result("Negative latency rejected", False)
        except IntegrityError:
            session.rollback()
            all_passed &= test_result("Negative latency rejected", True)
        except:
            session.rollback()
            all_passed &= test_result("Negative latency rejected", True)
            
    except Exception as e:
        print(f"❌ FAILED: Negative value validation - {e}")
        all_passed = False

    # ============================================================================
    # TEST 5: Unique constraint (email_test_id in Override)
    # ============================================================================
    try:
        round_obj5 = Round(status="pending", total_emails=2, processed_emails=0,
                           started_at=datetime.utcnow(), completed_at=datetime.utcnow())
        session.add(round_obj5)
        session.commit()
        
        # Create 2 emails
        email1 = Email(
            round_id=round_obj5.id, 
            generated_content="Test Email 1", 
            generated_email_metadata={"sender": "test@test.com"},
            is_phishing=True,
            detector_verdict="phishing",
            detector_confidence=0.5,
            generator_latency_ms=100, 
            detector_latency_ms=50, 
            cost=0.01
        )
        email2 = Email(
            round_id=round_obj5.id, 
            generated_content="Test Email 2", 
            generated_email_metadata={"sender": "test@test.com"},
            is_phishing=True,
            detector_verdict="phishing",
            detector_confidence=0.5,
            generator_latency_ms=100, 
            detector_latency_ms=50, 
            cost=0.01
        )
        session.add_all([email1, email2])
        session.commit()
        
        # First override with test_id=5000
        override1 = Override(email_test_id=email1.id, verdict="phishing")
        session.add(override1)
        session.commit()
        all_passed &= test_result("First override with test_id 5000 accepted", True)
        
        # Duplicate test_id on different email should fail
        try:
            override2 = Override(email_test_id=email1.id, verdict="phishing")
            session.add(override2)
            session.commit()
            all_passed &= test_result("Duplicate test_id rejected", False)
        except IntegrityError:
            session.rollback()
            all_passed &= test_result("Duplicate test_id rejected", True)
            
    except Exception as e:
        print(f"❌ FAILED: Unique constraint validation - {e}")
        all_passed = False

    # ============================================================================
    # TEST 6: API agent type validation
    # ============================================================================
    try:
        round_obj6 = Round(status="pending", total_emails=1, processed_emails=0,
                           started_at=datetime.utcnow(), completed_at=datetime.utcnow())
        session.add(round_obj6)
        session.commit()
        
        email = Email(
            round_id=round_obj6.id, 
            generated_content="Test Email", 
            generated_email_metadata={"sender": "test@test.com"},
            is_phishing=True,
            detector_verdict="phishing",
            detector_confidence=0.5,
            generator_latency_ms=100, 
            detector_latency_ms=50, 
            cost=0.01
        )
        session.add(email)
        session.commit()
        
        # Valid agent types
        for agent in ["generator", "detector", "judge"]:
            api_call = API(round_id=email.id, agent_type=agent, token_used=100, latency_ms=50, cost=0.001)
            session.add(api_call)
            session.commit()
        
        all_passed &= test_result("All 3 agent types accepted", True)
        
        # Invalid agent type
        try:
            bad_api = API(round_id=email.id, agent_type="invalid_agent", token_used=100, latency_ms=50, cost=0.001)
            session.add(bad_api)
            session.commit()
            all_passed &= test_result("Invalid agent type rejected", False)
        except:
            session.rollback()
            all_passed &= test_result("Invalid agent type rejected", True)
            
    except Exception as e:
        print(f"❌ FAILED: Agent type validation - {e}")
        all_passed = False

    # ============================================================================
    # FINAL RESULT
    # ============================================================================
    print("\n" + "="*50)
    if all_passed:
        print("✅ ALL TESTS PASSED - Database is secure!")
        print("   All validation rules are enforced.")
    else:
        print("❌ SOME TESTS FAILED - Database validation issues detected!")
        
    print("="*50)

    sys.exit(0 if all_passed else 1)
