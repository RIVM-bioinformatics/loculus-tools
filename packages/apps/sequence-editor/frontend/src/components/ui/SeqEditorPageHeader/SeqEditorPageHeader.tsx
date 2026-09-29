import { PageCommonHeader } from '@rivm-loculus-tools/frontend-common/components/page';
import BiotechOutlinedIcon from '@mui/icons-material/BiotechOutlined';

export const SeqEditorPageHeader = () => {


  return (
    <PageCommonHeader
      centerComponent={(
        <>
          {'test'}
        </>
      )}
      icon={<BiotechOutlinedIcon sx={{ fontSize: 24 }} />}
      rightComponent={(
        <>
          {'test'}
        </>
      )}
      title={'Sequence Editor'}
    />
  );
};
