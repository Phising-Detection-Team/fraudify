from marshmallow import Schema, fields, validate, EXCLUDE

class FeedbackCreateSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    subject = fields.Str(
        required=False, 
        allow_none=True,
        validate=validate.Length(max=255)
    )

    description = fields.Str(
        required=True, 
        validate=validate.Length(min=1),
        error_messages={'required': 'Description is required'}
    )

class FeedbackUpdateStatusSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    status = fields.Str(
        required=True,
        validate=validate.OneOf(['pending', 'reviewed', 'resolved']),
        error_messages={'required': 'Status is required'}
    )

