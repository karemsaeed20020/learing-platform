// middlewares/errorHandler.middleware.js
import { StatusCodes } from "http-status-codes";
import AppError from "../utils/AppError.js";

const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}.`;
  return new AppError(message, StatusCodes.BAD_REQUEST); 
};

const handleDuplicateFieldsDB = (err) => {
  const value = err.errmsg?.match(/(["'])(\\?.)*?\1/)?.[0] || 'unknown';
  console.log('Duplicate value:', value);
  
  const message = `Duplicate field value: ${value}. Please use another value!`;
  return new AppError(message, StatusCodes.BAD_REQUEST); 
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  
  const message = `Invalid input data. ${errors.join(". ")}`;
  return new AppError(message, StatusCodes.BAD_REQUEST); 
};

const handleJWTError = () => {
  return new AppError("Invalid token, Please log in again", StatusCodes.UNAUTHORIZED); 
};

const handleJWTExpiredError = () => {
  return new AppError("Your token has Expired! Please log in again!", StatusCodes.UNAUTHORIZED); 
};

const sendErrorDev = (err, res) => {
  // Ensure statusCode is a number
  const statusCode = Number(err.statusCode) || StatusCodes.INTERNAL_SERVER_ERROR;
  
  console.error('🐛 Development Error:', {
    message: err.message,
    stack: err.stack,
    statusCode: statusCode,
    isOperational: err.isOperational
  });

  res.status(statusCode).json({
    status: err.status,
    error: {
      name: err.name,
      message: err.message,
      statusCode: statusCode,
      isOperational: err.isOperational
    },
    message: err.message,
    stack: err.stack,
  });
};

const sendErrorProd = (err, res) => {
  // Ensure statusCode is a number
  const statusCode = Number(err.statusCode) || StatusCodes.INTERNAL_SERVER_ERROR;
  
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    // Programming or other unknown error: don't leak error details
    console.error("💥 Production Error:", {
      message: err.message,
      stack: err.stack,
      name: err.name
    });
    
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: "error",
      message: "Something went very wrong!",
    });
  }
};

export const errorResponseHandler = (err, req, res, next) => {
  // Ensure we have valid error properties
  err.statusCode = Number(err.statusCode) || 500;
  err.status = err.status || "error";

  console.log('📍 Error Handler Triggered:', {
    url: req.originalUrl,
    method: req.method,
    errorName: err.name,
    errorMessage: err.message,
    statusCode: err.statusCode
  });

  if (process.env.NODE_ENV === "development") {
    sendErrorDev(err, res);
  } else if (process.env.NODE_ENV === "production") {
    // Create a copy of the error object
    let error = { ...err };
    error.message = err.message;
    error.name = err.name;

    // Handle specific error types
    if (error.name === "CastError") error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === "ValidationError") error = handleValidationErrorDB(error);
    if (error.name === "JsonWebTokenError") error = handleJWTError();
    if (error.name === "TokenExpiredError") error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }
};