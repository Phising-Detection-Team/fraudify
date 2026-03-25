"""
Reusable pagination helper for SQLAlchemy queries.

Usage:
    from app.utils import paginate

    @bp.route('/items')
    def list_items():
        query = Item.query.filter_by(active=True)
        return jsonify(paginate(query, request.args))
"""

from flask import request as flask_request

DEFAULT_PAGE = 1
DEFAULT_PER_PAGE = 20
MAX_PER_PAGE = 100


def paginate(query, args=None, max_per_page=MAX_PER_PAGE):
    """
    Apply pagination to a SQLAlchemy query and return a standardized dict.

    Args:
        query: SQLAlchemy BaseQuery
        args: dict-like with optional 'page' and 'per_page' keys
              (defaults to flask request.args)
        max_per_page: upper limit for per_page to prevent abuse

    Returns:
        dict with 'items' (list of dicts), 'total', 'page', 'per_page', 'pages'
    """
    if args is None:
        args = flask_request.args

    try:
        page = int(args.get('page', DEFAULT_PAGE))
    except (TypeError, ValueError):
        page = DEFAULT_PAGE

    try:
        per_page = int(args.get('per_page', DEFAULT_PER_PAGE))
    except (TypeError, ValueError):
        per_page = DEFAULT_PER_PAGE

    page = max(1, page)
    per_page = max(1, min(per_page, max_per_page))

    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return {
        'items': [item.to_dict() for item in pagination.items],
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages,
        'has_next': pagination.has_next,
        'has_prev': pagination.has_prev,
    }
