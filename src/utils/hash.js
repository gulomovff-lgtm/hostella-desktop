/**
 * Hash a string using SHA-256 via Web Crypto API.
 * Returns a lowercase hex string (64 chars).
 */
export async function hashPassword(str) {
    if (!str) return '';
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Check if a stored password value is already a SHA-256 hex hash.
 * SHA-256 hex is always exactly 64 lowercase hex chars.
 */
export function isHashed(pass) {
    return typeof pass === 'string' && pass.length === 64 && /^[0-9a-f]+$/.test(pass);
}

/**
 * Verify a plaintext password against a stored value.
 * Supports both hashed and legacy plaintext passwords.
 * Returns { match: boolean, needsUpgrade: boolean }
 */
export async function verifyPassword(input, stored) {
    if (!input || !stored) return { match: false, needsUpgrade: false };

    if (isHashed(stored)) {
        // Stored is hashed — compare against hash of input
        const hashed = await hashPassword(input);
        return { match: hashed === stored, needsUpgrade: false };
    } else {
        // Stored is plaintext (legacy) — compare directly; flag for upgrade
        return { match: input === stored, needsUpgrade: input === stored };
    }
}
