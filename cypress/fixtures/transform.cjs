module.exports = async entry => {
  try {
    if (entry.response.content?.text) {
      entry.response.content = {
        ...entry.response.content,
        text: entry.response.content.text.replace(
          /"products":\s*(.+)/g,
          `"items":$1`
        )
      };
    }

    return entry;
  } catch {
    return entry;
  }
};
