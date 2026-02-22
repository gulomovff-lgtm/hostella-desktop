/**
 * Hostella Booking Widget — embed script
 *
 * Usage on any website:
 *   <div id="hostella-booking"></div>
 *   <script src="https://hostella.uz/widget.js"></script>
 *
 * Optional: pre-select a hostel
 *   <div id="hostella-booking" data-hostel="hostel2"></div>
 */
(function () {
  var container = document.getElementById('hostella-booking');
  if (!container) {
    console.warn('[Hostella] Element #hostella-booking not found.');
    return;
  }

  var hostel = container.getAttribute('data-hostel') || '';
  var src = 'https://hostella.uz/booking.html' + (hostel ? '?hostel=' + hostel : '');

  var iframe = document.createElement('iframe');
  iframe.src = src;
  iframe.title = 'Hostella — онлайн бронирование';
  iframe.allow = 'clipboard-write';
  iframe.style.cssText = [
    'width:100%',
    'min-height:640px',
    'border:none',
    'border-radius:20px',
    'display:block',
    'box-shadow:0 8px 40px -8px rgba(0,0,0,0.18)',
  ].join(';');

  // Auto-resize: communicate height from widget page via postMessage
  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'hostella-resize') {
      iframe.style.minHeight = e.data.height + 'px';
    }
  });

  container.appendChild(iframe);
})();
