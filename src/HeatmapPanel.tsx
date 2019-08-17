import React from 'react';
import {HeatmapPanelProps} from './types';
import HeatmapViz from "./HeatmapViz";

// Inspired by
// http://bl.ocks.org/ganeshv/6a8e9ada3ab7f2d88022


export const HeatmapPanel: React.FunctionComponent<HeatmapPanelProps> = ({
   data,
   timeRange,
   width,
   height,
   options,
   onOptionsChange,
  }) => {
  if (!data) {
    return (
        <div className="panel-empty">
          <p>No data found in response</p>
        </div>
    );
  }
  // const dataAsJson = JSON.stringify(data);

  return (
      <HeatmapViz
          data={data}
          width={width}
          height={height} />
  );

};
