import React from 'react';
import {HeatmapPanelProps} from "./types";
import draw from "./HeatmapD3";
import {PanelData} from "@grafana/ui";

export interface HeatmapVizProperties {
    data: PanelData;
    width: number;
    height: number;
}

export default class HeatmapViz extends React.Component<HeatmapVizProperties> {
    componentDidMount(): void {
        draw(this.props);
    }
    componentDidUpdate(prevProps: HeatmapPanelProps): void {
        draw(this.props);
    }

    render() {
        return (
            <div className="heatmap-viz" />
        );
    }
}
