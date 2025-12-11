
export const sanitizeDataForFirebase = (data: any): any => {
  if (data === null || data === undefined) {
    return null;
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeDataForFirebase(item));
  }

  const sanitizedObject: { [key: string]: any } = {};
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const value = data[key];
      if (value !== undefined) {
        sanitizedObject[key] = sanitizeDataForFirebase(value);
      }
    }
  }

  return sanitizedObject;
};
