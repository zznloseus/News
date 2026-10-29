import React from 'react';
import {createRoot} from 'react-dom/client';
import Observatory from './V4Observatory';
import './styles.css';
import './keywords.css';
import './workspace.css';
import './v4.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><Observatory/></React.StrictMode>);
