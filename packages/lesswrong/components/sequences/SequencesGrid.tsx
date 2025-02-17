import { Components, registerComponent } from '../../lib/vulcan-lib';
import React from 'react';
import { legacyBreakpoints } from '../../lib/utils/theme';

// Shared with SequencesGridWrapper
export const styles = (theme: ThemeType): JssStyles => ({
  grid: {
  },
  gridContent: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    flexFlow: "row wrap",
    justifyContent: "space-between",
    [legacyBreakpoints.maxSmall]: {
      alignItems: "center",
      justifyContent: "center",
    },

    "& a:hover, & a:active": {
      textDecoration: "none",
      color: theme.palette.link.unmarked,
    }
  },
  noResults: {
    marginLeft: theme.spacing.unit,
    fontStyle: "italic",
    color: theme.palette.text.dim4,
  }
});

const SequencesGrid = ({sequences, showAuthor, classes, bookItemStyle }: {
  sequences: Array<SequencesPageFragment>,
  showAuthor?: boolean,
  classes: ClassesType,
  bookItemStyle?: boolean
}) =>
  <div className={classes.grid}>
    <div className={classes.gridContent}>
      {sequences.map(sequence => {
        return (
          <Components.SequencesGridItem
            sequence={sequence}
            key={sequence._id}
            showAuthor={showAuthor}
            bookItemStyle={bookItemStyle}
          />
        );
      })}
    </div>
  </div>

const SequencesGridComponent = registerComponent('SequencesGrid', SequencesGrid, {styles});

declare global {
  interface ComponentTypes {
    SequencesGrid: typeof SequencesGridComponent
  }
}

