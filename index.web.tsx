// index.web.tsx
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import materialDesignIconsFont from '@react-native-vector-icons/material-design-icons/fonts/MaterialDesignIcons.ttf';

const iconFont = new FontFace('MaterialDesignIcons', `url(${materialDesignIconsFont as unknown as string})`);
iconFont.load().then((loadedFont) => {
  document.fonts.add(loadedFont);
});

AppRegistry.registerComponent(appName, () => App);

AppRegistry.runApplication(appName, {
  rootTag: document.getElementById('app-root'),
});
