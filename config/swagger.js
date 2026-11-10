import swaggerJSDoc from 'swagger-jsdoc';
import dotenv from 'dotenv';
dotenv.config();

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Translate API',
      version: '2.0.0',
      description: 'API documentation for the Translate System',
    },
    servers: [
      {
        url: process.env.SWAGGER_URL || '/',
      },
    ],
    security: [
      {
        bearerAuth: [],
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your JWT token in the format: Bearer {token}",
        },
      },
    },
  },
  apis: ['./routes/*.js'],
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;
