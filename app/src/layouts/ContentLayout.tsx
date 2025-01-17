import Box from '@mui/material/Box';
import { makeStyles } from '@mui/styles';

const useStyles = makeStyles(() => ({
  contentLayoutRoot: {
    width: 'inherit',
    height: '100%',
    display: 'flex',
    flex: '1',
    flexDirection: 'column'
  },
  contentContainer: {
    flex: '1',
    overflow: 'auto'
  }
}));

const ContentLayout: React.FC<React.PropsWithChildren> = (props) => {
  const classes = useStyles();

  return (
    <Box className={classes.contentLayoutRoot}>
      <Box className={classes.contentContainer}>{props.children}</Box>
    </Box>
  );
};

export default ContentLayout;
