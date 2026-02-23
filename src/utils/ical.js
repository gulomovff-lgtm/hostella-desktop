/**
 * Parse Booking.com iCal (RFC 5545) into an array of reservation objects.
 * Filters out "CLOSED / Not available" blocks — returns only real guest reservations.
 */
export function parseIcal(text) {
    // Unfold continuation lines (RFC 5545 §3.1)
    const unfolded = text.replace(/\r?\n[ \t]/g, '');
    const lines    = unfolded.split(/\r?\n/);

    const events = [];
    let current  = null;

    for (const line of lines) {
        if (line === 'BEGIN:VEVENT') {
            current = {};
        } else if (line === 'END:VEVENT' && current) {
            events.push(current);
            current = null;
        } else if (current) {
            const idx = line.indexOf(':');
            if (idx < 0) continue;
            // Strip parameters (e.g. DTSTART;VALUE=DATE → DTSTART)
            const key = line.slice(0, idx).split(';')[0].toUpperCase();
            const val = line.slice(idx + 1)
                .replace(/\\n/g, '\n')
                .replace(/\\,/g, ',')
                .replace(/\\;/g, ';')
                .replace(/\\"/g, '"');
            current[key] = val;
        }
    }

    const parseDate = (str) => {
        if (!str) return null;
        // DATE: YYYYMMDD
        if (/^\d{8}$/.test(str)) return `${str.slice(0,4)}-${str.slice(4,6)}-${str.slice(6,8)}`;
        // DATETIME: YYYYMMDDTHHmmss[Z]
        try { return new Date(str).toISOString().slice(0, 10); } catch { return null; }
    };

    return events
        .map(ev => {
            const summary = ev.SUMMARY || '';
            const desc    = ev.DESCRIPTION || '';

            // Skip blocked / unavailable slots
            if (/closed|not available|unavailable|block/i.test(summary)) return null;

            const nameMatch  = desc.match(/(?:^|\n)Name:\s*(.+)/im);
            const resIdDesc  = desc.match(/Reservation\s*(?:ID)?:\s*(\S+)/i)?.[1];
            const resIdSum   = summary.match(/Reservation\s+(\S+)/i)?.[1];
            // Booking.com uses "Room type:" or "Room:" 
            const roomMatch  = desc.match(/Room\s*(?:type)?:\s*(.+)/i);
            const guestMatch = desc.match(/Number of guests:\s*(\d+)/i);

            return {
                uid:           ev.UID || '',
                reservationId: resIdDesc || resIdSum || ev.UID || '',
                name:          nameMatch?.[1]?.trim() || summary.replace(/^Reservation\s+/i, '').trim() || 'Гость',
                checkIn:       parseDate(ev.DTSTART),
                checkOut:      parseDate(ev.DTEND),
                room:          roomMatch?.[1]?.trim() || '',
                guests:        parseInt(guestMatch?.[1]) || 1,
            };
        })
        .filter(Boolean);
}
