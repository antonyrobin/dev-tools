# 🛠️ DevTools Suite

Welcome to the **DevTools Suite**, a comprehensive open-source web application designed to provide developers with essential tools integrated into a single, intuitive platform. Built with modern web technologies, it includes zero-configuration utilities ranging from code formatting and optimizing to QR and barcode generation. 

Our goal is to boost developer productivity by bringing everyday, critical tools straight to your web browser with enterprise-level security and performance.

---

## 🚀 Project Stack

This project is built using a modern, snappy frontend stack:

- **Framework**: [React 19](https://react.dev/) ⚛️
- **Build Tool**: [Vite](https://vitejs.dev/) ⚡ for lightning-fast development, HMR, and highly optimized production builds.
- **Routing**: `react-router-dom` for seamless client-side navigation.
- **Styling**: Context-aware custom CSS combined with `lucide-react` for scalable, beautiful UI icons.
- **Core Integrations**: 
  - `prettier` formatters
  - `qrcode.react` for rendering QR paths
  - `react-barcode` for dynamic structural barcodes
- **Security**: [@marsidev/react-turnstile](https://www.npmjs.com/package/@marsidev/react-turnstile) wrapper for Cloudflare integration.
- **Linting**: Strict ESLint configuration for code quality maintenance.

---

## 🔒 Security & Bot Management

DevTools Suite deeply values user security and reliable web deployment. 

We have actively integrated **Cloudflare Turnstile** smart CAPTCHA alternatives throughout the application environment. 
- Turnstile proactively mitigates bot abuse, automated attacks, and spam seamlessly.
- Eliminates frustrating puzzle-solving user experiences.
- Employs advanced privacy-preserving checks to determine real visitors dynamically.

*To run Turnstile locally, ensure your `.env` file mimics the provided test site keys.*

---

## ⚙️ Setup Guidelines

Follow these steps to set up the project locally for development or contributions:

### Prerequisites

- **Node.js**: Version 18 or higher recommended.
- **Package Manager**: npm or yarn.

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository_url>
   cd dev-tools
   ```

2. **Install all module dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in your root project directory:
   ```env
   VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```
   *The application will boot up locally (typically at `http://localhost:5173`). Open this URL in your web browser to view the application.*

### Building for Production

To create an optimized, minified production-ready build, run:
```bash
npm run build
```
This command generates the deployment artifacts in the `dist` directory. You can preview this build locally using:
```bash
npm run preview
```

---

## 💡 Functionalities in Detail

The application modules comprise several powerful utilities out of the box:

### 1. 📝 Code Formatter
A robust formatting tool that integrates natively with Prettier to parse and format code (e.g., JavaScript, JSON, CSS) beautifully. It maintains team consistency and maximizes syntax readability.

### 2. 💻 Code Compiler
An interface dedicated to scaffolding, compiling, or executing targeted coding languages immediately inside the browser to test behavioral outcomes without complex local container setups.

### 3. 🗜️ Code Minifier
Allows developers to stringently compress code strings by stripping unnecessary whitespace, comments, and line breaks. It drastically trims down file size dimensions, making front-end assets optimal for production caching.

### 4. 🔍 Code Reviewer
An automated analytical tool to review generic code snippets. It flags potential syntax issues, recognizes anti-patterns, and outlines actionable suggestions for structural quality enhancement.

### 5. ⚡ Code Optimizer
Takes raw snippets and returns actionable insights alongside refactoring plans to ensure code utilizes underlying system resources synchronously and aligns with modern design principles.

### 6. 📱 QR Code Generator
A straightforward, highly versatile tool for generating QR codes dynamically. Users can map any raw text, VCard details, or specific dynamic URLs to instantly create high-resolution downloadable SVG/PNG visual blocks.

### 7. 🏷️ Barcode Generator
A feature-rich encoding tool capable of creating dynamic and sequential standard barcodes (e.g., Code128 format) on the fly—highly beneficial for warehouse inventory tracing, ticketing, and POS prints.

---

## ⚖️ Legal & Licensing

- **Legal Links**: The repository structure comes built-in with essential user-facing static documents configured on standard routes (`/privacy`, `/terms`).
- **Open Source**: This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for open usage details.

*Built with ❤️ for modern developer ecosystems.*
