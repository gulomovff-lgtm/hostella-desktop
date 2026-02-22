import React from 'react';
import ReactDOM from 'react-dom/client';
import './booking.css';
import '../index.css';
import BookingWidget from './BookingWidget.jsx';

ReactDOM.createRoot(document.getElementById('booking-root')).render(
  <React.StrictMode>
    <BookingWidget />
  </React.StrictMode>
);
