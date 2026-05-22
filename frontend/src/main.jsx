import React from 'react';
import { createRoot } from 'react-dom/client';
import './legacy.css';
import './overrides.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(<App />);
