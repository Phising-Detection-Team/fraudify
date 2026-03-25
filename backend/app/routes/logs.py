"""
System event log API endpoints.

GET /api/logs - List logs with level, time range, and round filters
"""

from datetime import datetime
from flask import Blueprint, jsonify, request
from sqlalchemy import desc

from app.models import Log
from app.errors import ValidationError
from app.utils import paginate

logs_bp = Blueprint('logs', __name__)


@logs_bp.route('/logs', methods=['GET'])
def list_logs():
    """
    List system logs with filters and pagination.

    Query params:
        level     (str):  filter by level (info, warning, error, critical)
        round_id  (int):  filter by round
        from      (str):  ISO datetime lower bound (inclusive)
        to        (str):  ISO datetime upper bound (inclusive)
        search    (str):  text search in message field
        page      (int):  page number
        per_page  (int):  items per page
    """
    query = Log.query

    level = request.args.get('level')
    if level:
        allowed = {'info', 'warning', 'error', 'critical'}
        if level not in allowed:
            raise ValidationError(f'level must be one of {allowed}')
        query = query.filter_by(level=level)

    round_id = request.args.get('round_id')
    if round_id is not None:
        try:
            query = query.filter_by(round_id=int(round_id))
        except (TypeError, ValueError):
            raise ValidationError('round_id must be an integer')

    from_dt = request.args.get('from')
    if from_dt:
        try:
            dt = datetime.fromisoformat(from_dt)
            query = query.filter(Log.timestamp >= dt)
        except ValueError:
            raise ValidationError('from must be a valid ISO datetime (e.g. 2026-02-01T00:00:00)')

    to_dt = request.args.get('to')
    if to_dt:
        try:
            dt = datetime.fromisoformat(to_dt)
            query = query.filter(Log.timestamp <= dt)
        except ValueError:
            raise ValidationError('to must be a valid ISO datetime')

    search = request.args.get('search')
    if search:
        query = query.filter(Log.message.ilike(f'%{search}%'))

    query = query.order_by(desc(Log.timestamp))

    result = paginate(query)
    return jsonify({'success': True, **result}), 200
