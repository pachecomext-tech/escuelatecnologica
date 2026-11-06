export const conflict = error => error?.name === 'BlobPreconditionFailedError' || error?.name === 'BlobAlreadyExistsError';
