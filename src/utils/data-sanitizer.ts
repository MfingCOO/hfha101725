/**
 * Recursively sanitizes an object or array to remove `undefined` values.
 * This is crucial for Firestore, which does not support `undefined`.
 * It handles nested objects and arrays.
 *
 * @param data The data to sanitize (object, array, or primitive).
 * @returns The sanitized data.
 */
export const sanitizeForFirestore = <T>(data: T): T => {
    if (data === null || typeof data !== 'object') {
        return data;
    }

    if (Array.isArray(data)) {
        // If it's an array, map over it, sanitize each element, and filter out any resulting undefined values.
        // We have to cast to `any` because TS can't infer the type of the mapped/filtered array.
        return (data as any[]).map(sanitizeForFirestore).filter(item => item !== undefined) as T;
    }

    // It's an object. Create a copy and sanitize its properties.
    const newObj = { ...data } as Record<string, any>;
    for (const key in newObj) {
        if (newObj.hasOwnProperty(key)) {
            const value = newObj[key];
            if (value === undefined) {
                delete newObj[key];
            } else if (value !== null && typeof value === 'object') {
                // Recursively sanitize nested objects/arrays.
                newObj[key] = sanitizeForFirestore(value);
            }
        }
    }

    return newObj as T;
};
