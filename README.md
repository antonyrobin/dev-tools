# DevTools Suite

DevTools Suite is a comprehensive web application designed to provide developers with essential tools integrated into a single, intuitive platform. Built with modern web technologies, it includes features ranging from code formatting and optimizing to QR and barcode generation.

## Project Stack

This project is built using a modern frontend stack:

- **Framework**: [React 19](https://react.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/) for lightning-fast development, HMR, and optimized builds.
- **Routing**: `react-router-dom` for client-side navigation.
- **Styling**: Custom CSS and `lucide-react` for scalable UI icons.
- **Code Parsing/Formatting**: `prettier` and `standalone` parsers.
- **Generators**: `qrcode.react` for QR codes and `react-barcode` for dynamic and sequential barcodes.
- **Linting**: ESLint configuration for code quality maintenance.

## Setup Guidelines

Follow these steps to set up the project locally:

### Prerequisites

- Node.js (version 18 or higher recommended)
- npm (Node Package Manager)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository_url>
   cd dev-tools
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   The application will typically start at `http://localhost:5173`. Open this URL in your web browser.

### Building for Production

To create a production-ready build, run:
```bash
npm run build
```
This command generates an optimized bundle in the `dist` directory. You can preview this build locally using:
```bash
npm run preview
```

## Functionalities in Detail

The application comprises several powerful modules designed to boost developer productivity and utility:

### 1. Code Formatter
A robust formatting tool that integrates with Prettier to parse and format code (e.g., JavaScript, JSON, CSS) beautifully. It maintains code consistency and maximizes readability.

### 2. Code Compiler
An interface dedicated to compiling or executing targeted coding languages seamlessly, aiding developers in testing structural behaviors without complex local setups.

### 3. Code Minifier
Allows developers to compress their code strings by removing unnecessary whitespace, comments, and line breaks. It drastically trims down file sizes making assets optimal for production deployment.

### 4. Code Reviewer
An analytical tool to review short code snippets. It aims to flag potential syntax issues, recognize poor implementation patterns, and provide suggestions for enhanced overall code quality.

### 5. Code Optimizer
Provides actionable insights and structural refactoring suggestions to ensure code utilizes system resources effectively and aligns tightly with modern best practices.

### 6. QR Code Generator
A straightforward yet versatile tool for generating QR codes dynamically. Users can map any text, contact details, or URL to create high-resolution downloadable QR code visual images.

### 7. Barcode Generator
A feature-rich generator tool capable of creating dynamic and sequential standard barcodes on the fly, beneficial for inventory testing or printing labels.

---

**Note**: The repository also comes built-in with essential legal routing elements such as the **Privacy Policy** and **Terms of Service** pages.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
