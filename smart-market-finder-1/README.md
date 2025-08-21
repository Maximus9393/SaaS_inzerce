# smart-market-finder

## Overview
The **smart-market-finder** project is a full-stack application that allows users to search for market products based on specified criteria. It consists of a backend built with Express and a frontend developed using React.

## Project Structure
The project is organized into two main directories: `backend` and `frontend`.

### Backend
- **src/**: Contains the source code for the backend application.
  - **controllers/**: Contains the `marketController.ts` which handles the business logic for market-related operations.
  - **routes/**: Contains the `marketRoutes.ts` which defines the API routes for the application.
  - **services/**: Contains the `marketService.ts` which includes functions for handling market search logic.
  - **models/**: Contains the `market.ts` file that defines the data model for market results.
  - **utils/**: Contains utility functions such as logging.
  - **types/**: Contains TypeScript definitions for type safety.
- **package.json**: Lists the backend dependencies and scripts.
- **tsconfig.json**: TypeScript configuration for the backend.
- **README.md**: Documentation specific to the backend.

### Frontend
- **src/**: Contains the source code for the frontend application.
  - **components/**: Contains reusable components like `MapView`.
  - **pages/**: Contains page components such as `Home`.
  - **services/**: Contains API service functions for making requests to the backend.
  - **hooks/**: Contains custom hooks for managing state and logic.
  - **styles/**: Contains CSS styles for the application.
  - **types/**: Contains TypeScript definitions for the frontend.
- **public/**: Contains the main HTML file for the React application.
- **package.json**: Lists the frontend dependencies and scripts.
- **tsconfig.json**: TypeScript configuration for the frontend.

## Getting Started
To get started with the project, follow these steps:

1. **Clone the repository**:
   ```
   git clone <repository-url>
   cd smart-market-finder
   ```

2. **Install dependencies**:
   - For the backend:
     ```
     cd backend
     npm install
     ```
   - For the frontend:
     ```
     cd ../frontend
     npm install
     ```

3. **Run the backend server**:
   ```
   cd backend
   npm start
   ```

4. **Run the frontend application**:
   ```
   cd frontend
   npm start
   ```

## API Endpoints
- **POST /search**: Accepts search criteria and returns matching market products.
- **GET /results**: Returns the last found products.

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License
This project is licensed under the MIT License.