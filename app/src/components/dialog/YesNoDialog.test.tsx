import YesNoDialog from 'components/dialog/YesNoDialog';
import { fireEvent, render, waitFor } from 'test-helpers/test-utils';

const handleOnYes = jest.fn();
const handleOnNo = jest.fn();
const handleOnClose = jest.fn();

const renderContainer = ({
  dialogTitle,
  dialogText,
  open = true
}: {
  dialogTitle: string;
  dialogText: string;
  open?: boolean;
}) => {
  return render(
    <div id="root">
      <YesNoDialog
        dialogTitle={dialogTitle}
        dialogText={dialogText}
        open={open}
        onClose={handleOnClose}
        onNo={handleOnNo}
        onYes={handleOnYes}
      />
    </div>
  );
};

describe('EditDialog', () => {
  it('Does not render dialog pop up when open set to false', () => {
    const { queryByText } = renderContainer({ dialogTitle: 'this is a test', dialogText: 'this is text', open: false });

    expect(queryByText('this is a test')).toEqual(null);
  });

  it('Does render dialog pop up when open set to true', () => {
    const { getByText } = renderContainer({ dialogTitle: 'this is a test', dialogText: 'this is text' });

    expect(getByText('this is a test')).toBeVisible();
  });

  it('Does render dialog pop up and error msgs when open set to true', () => {
    const { getByText } = renderContainer({ dialogTitle: 'this is a test', dialogText: 'This is an error' });

    expect(getByText('this is a test')).toBeVisible();
    expect(getByText('This is an error')).toBeVisible();
  });

  it('calls the onYes prop when `Yes` button is clicked', async () => {
    const { findByText } = renderContainer({ dialogTitle: 'this is a test', dialogText: 'this is text' });

    const YesButton = await findByText('Yes', { exact: false });

    fireEvent.click(YesButton);

    await waitFor(() => {
      expect(handleOnYes).toHaveBeenCalledTimes(1);
    });
  });

  it('calls the onNo prop when `No` button is clicked', async () => {
    const { findByText } = renderContainer({
      dialogTitle: 'this is a test',
      dialogText: 'this is text'
    });

    const NoButton = await findByText('No', { exact: false });

    fireEvent.click(NoButton);

    await waitFor(() => {
      expect(handleOnNo).toHaveBeenCalledTimes(1);
    });
  });
});
