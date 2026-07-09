# Copilot Instructions for Consolatrician Portal

## Project Overview
This is a **React + Vite** web-based application designed for clients to have a convenient and faster access to local services in the city of Toledo. The frontend uses **React 19** with **React Router v7** for navigation, **Bootstrap 5** for styling, and **Vite** as the build tool.

## Architecture & Structure

### Component Hierarchy
- **App.jsx**: Main router container with sticky `<Navbar />` and `<Footer />` wrapping route pages
- **Page Components**: `Home.jsx`, `About.jsx`, `Login.jsx`, `Register.jsx` - all route-driven pages
- **Layout Components**: `Navbar.jsx` uses `<Link>` from react-router-dom for client-side navigation
- **Styling**: Global layout in `App.css` uses CSS custom properties and glassmorphism design patterns

### Routing Pattern (React Router v7)
Routes are defined in `App.jsx` using `<Routes>` and `<Route>` components:
```jsx
<Route path="/" element={<Home />} />
<Route path="/about" element={<About />} />
<Route path="/login" element={<Login />} />
<Route path="/register" element={<Register />} />
```
Note: Navbar references a `/track-request` route that needs implementation.

### Entry Point
- `main.jsx` wraps the app in `<BrowserRouter>` and imports Bootstrap CSS/JS globally
- All Bootstrap styles and icons are loaded at app initialization

## Development Workflow

### Essential Commands
- **`npm run dev`**: Start Vite dev server with HMR (Hot Module Reload)
- **`npm run build`**: Production build to `dist/` folder
- **`npm run lint`**: Run ESLint across `.js` and `.jsx` files
- **`npm run preview`**: Preview production build locally

### Build & Environment
- Build output: `dist/` directory (ignored by git)
- ESLint ignores: `dist/` folder, allows component files (capitals ignored in unused-vars)
- Vite config is minimal (`defineConfig` with react plugin only)

## Code Conventions & Patterns

### Component Patterns
1. **Functional Components**: All components are functional (no class components)
2. **State Management**: Use `useState()` hook (e.g., Navbar's `searchVisible` state)
3. **Styling**: Mix Bootstrap utility classes with `App.css` custom properties
4. **Assets**: Import images/icons from `./assets/` folder (e.g., `logo.png`, `hero-banner.jpg`)

### CSS Custom Properties (App.css)
Key design tokens used throughout:
- `--glass-bg`: Glassmorphism background
- `--glass-border`: Border color for glass cards
- `--primary-blue`, `--primary-blue-dark`: Brand colors
- Cards use `.glass-card` class with backdrop-filter blur effect
- Flexbox layout: `.app-wrapper { min-height: 100vh; display: flex; flex-direction: column; }`

### Form Patterns (Login/Register)
- Uncontrolled inputs (no state binding yet) using plain `<input>` with Bootstrap `.form-control`
- Buttons use `.btn .btn-primary` utility classes
- Forms centered in `.auth-card` using flexbox
- Link between login/register pages using React Router `<Link>`

### Icon Usage
- Bootstrap Icons (1.13.1) imported in `main.jsx`
- Icons used as CSS classes: `bi-file-earmark-text`, `bi-bell`, `bi-clipboard-check`, etc.
- Example in Home.jsx: `<i className="bi-file-earmark-text"></i>`

## Integration Points & Dependencies

### External Libraries
- **react-router-dom (v7.11.0)**: Client-side routing via `<BrowserRouter>`, `<Routes>`, `<Route>`, `<Link>`
- **bootstrap (v5.3.8)**: CSS utilities and responsive grid
- **bootstrap-icons (v1.13.1)**: Icon set for UI elements
- **react (v19.2.0)**: Core framework with StrictMode enabled

### Future Integration Needs
- Authentication: Login/Register components exist but have no form submission handlers
- Backend API: No API calls present; will need fetch/axios implementation for document requests, announcements, clearance tracking
- State Management: Consider Redux/Zustand if complex cross-component state emerges

## Common Tasks & Examples

### Adding a New Route
1. Create component in `src/` (e.g., `Events.jsx`)
2. Import in `App.jsx`
3. Add route: `<Route path="/events" element={<Events />} />`
4. Add navigation link in `Navbar.jsx` using `<Link to="/events">`

### Adding New CSS Styling
- Use Bootstrap classes first for responsive design
- Add custom CSS to `App.css` following existing pattern (sections with comment headers)
- Define new custom properties in CSS for reusable design tokens
- Apply glassmorphism: use `.glass-card` base class or replicate `backdrop-filter: blur(10px)`

### Handling Form Inputs (Auth Pages)
- Current pattern: uncontrolled inputs ready for backend integration
- When adding handlers: Convert to controlled inputs with `useState()` for each field
- Validate on submission, not onChange

## ESLint Configuration
- Config: `eslint.config.js` (flat config format)
- Rules: Variables starting with capitals (components) ignored in unused-vars rule
- Plugins: react-hooks (enforces hook rules) and react-refresh (Vite Fast Refresh)
- No TypeScript configured (pure JSX/JS project)

## Notes for AI Assistants
- Glassmorphism design is core aesthetic; maintain blur effects and transparency in new components
- Bootstrap responsive classes (lg, md, sm breakpoints) are standard; avoid hardcoding pixel widths
- All routes should fit the sticky navbar + footer layout pattern
- File organization: components at `src/` root, assets in `src/assets/`, one component per file
