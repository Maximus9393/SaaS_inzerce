# Smart Market Finder Backend

This is the backend for the Smart Market Finder project, which provides an Express API for searching market products.

## Project Structure

- **src/**: Contains the source code for the backend application.
  - **controllers/**: Contains the controller files that handle incoming requests and responses.
  - **routes/**: Contains the route definitions for the API endpoints.
  - **services/**: Contains the business logic for handling market searches.
  - **models/**: Contains the data models for the application.
  - **utils/**: Contains utility functions, such as logging.
  - **types/**: Contains TypeScript type definitions for the application.

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd smart-market-finder/backend
   ```

2. Install dependencies:
   ```
   npm install
   ```

## Running the Application

To start the backend server, run:
```
npm start
```

The server will be running on `http://localhost:3000`.

## API Endpoints

- **POST /search**: Receives search criteria from the user.
- **GET /results**: Returns the last found products.

## Logging

The application uses a logger utility for logging messages and errors. Ensure to check the logs for any issues during development.

## Contributing

Feel free to submit issues or pull requests for improvements or bug fixes.