export default async entry => {
  try {
    return /\{"products":\[/.test(entry.response.content.text ?? '');
  } catch {
    return false;
  }
};
