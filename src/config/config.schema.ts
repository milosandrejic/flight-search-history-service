import Joi from "joi";

export const configValidationSchema = Joi.object({
  DYNAMODB_REGION: Joi.string().required(),
  DYNAMODB_TABLE_NAME: Joi.string().required(),
  SESSION_TTL_SECONDS: Joi.number().integer().min(1).default(1800),
});
