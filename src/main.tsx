import React from 'react';
import {createRoot} from 'react-dom/client';
import Observatory from './Observatory';
import './styles.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><Observatory/></React.StrictMode>);
