import { body } from "express-validator";

export const createRoomValidator = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Room name is required")
    .isLength({ max: 50 })
    .withMessage("Room name must be less than 50 characters"),
  body("description")
    .optional()
    .isString()
    .withMessage("Description must be a string"),
  body("is_private")
    .optional()
    .isBoolean()
    .withMessage("is_private must be a boolean"),
];

export const updateRoomValidator = [
  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Room name cannot be empty")
    .isLength({ max: 50 })
    .withMessage("Room name must be less than 50 characters"),
  body("description")
    .optional()
    .isString()
    .withMessage("Description must be a string"),
];
