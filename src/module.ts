import { loadPluginCss } from 'grafana/app/plugins/sdk';
import { HeatmapCtrl } from './heatmapControl';
import { lightCss, darkCss } from './properties';

loadPluginCss({
  dark: darkCss,
  light: lightCss,
});

// export default HeatmapCtrl;
export { HeatmapCtrl as PanelCtrl };
