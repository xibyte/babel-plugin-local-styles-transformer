
export default function(stylesValue, localStyles) {
  let styles = stylesValue.split(/\s+/);
  let localStyleValues = [];
  for (let style of styles) {
    if (style !== '') {
      for (let localStyle of localStyles) {
        let localStyleValue = localStyle[style];
        if (localStyleValue) {
          localStyleValues.push(localStyleValue);
          break;
        }
      }
    }
  }
  return localStyleValues.join(' ');
}