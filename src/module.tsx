import { HeatmapPanel } from './HeatmapPanel';
import { PanelPlugin } from '@grafana/ui';
import { HeatmapEditor } from './HeatmapEditor';
import { Options, defaults } from './types';
export const plugin = new PanelPlugin<Options>(HeatmapPanel).setDefaults(defaults).setEditor(HeatmapEditor);
