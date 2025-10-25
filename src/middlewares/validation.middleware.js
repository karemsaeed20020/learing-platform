// middlewares/validation.middleware.js
import AppError from '../utils/AppError.js';
import { StatusCodes } from 'http-status-codes';

const isValid = (schema) => {
  return (req, res, next) => {
    try {      
      const { error, value } = schema.validate(req.body, { 
        abortEarly: false,
        allowUnknown: false,
        stripUnknown: true
      });

      if (error) {
        const errorMessages = error.details.map(detail => detail.message);
        
        return next(
          new AppError(
            `Validation Error: ${errorMessages.join(', ')}`,
            StatusCodes.BAD_REQUEST
          )
        );
      }

      req.validatedData = value;
      next();
    } catch  {
      return next(
        new AppError('Validation process failed', StatusCodes.INTERNAL_SERVER_ERROR)
      );
    }
  };
};

export default isValid;