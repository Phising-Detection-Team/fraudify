**Alembic**
1. Initiate Migration:
alembic init migration

2. Autogenerate
alembic revision --autogenerate -m "add users table"

3. Upgrade / Downgrade
alembic upgrade head
alembic downgrade -1

4. Apply migration
alembic upgrade head

5. Initialize migration
alembic upgrade head


6. Run some rounds
cd /home/hoang/projects/phishing_detection
chmod +x ./run_detection.sh
./run_detection.sh --method openai --rounds 3 --emails 10 --workflows 2

DROP SCHEMA public CASCADE; CREATE SCHEMA public;