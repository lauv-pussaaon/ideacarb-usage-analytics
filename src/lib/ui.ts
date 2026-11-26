export const pageShellSx = {
  flexGrow: 1,
  minWidth: 0,
  px: { xs: 2, md: 4 },
  py: 3,
} as const

export const cardSx = {
  bgcolor: 'background.paper',
  borderRadius: 3,
  boxShadow: '0 8px 30px rgba(15, 23, 42, 0.06)',
} as const

export const pillGroupSx = {
  bgcolor: 'grey.100',
  borderRadius: 999,
  p: 0.5,
  alignSelf: 'flex-start',
  '& .MuiToggleButtonGroup-grouped': {
    border: 0,
    borderRadius: '999px !important',
    mx: 0.25,
    px: 1.75,
    py: 0.75,
    textTransform: 'none',
    fontSize: '1.05rem',
  },
  '& .MuiToggleButton-root.Mui-selected': {
    bgcolor: 'common.black',
    color: 'common.white',
    '&:hover': { bgcolor: 'common.black' },
  },
} as const

export const backButtonSx = {
  mb: 2,
  textTransform: 'none',
  color: 'text.secondary',
  px: 0,
  '&:hover': { backgroundColor: 'transparent', color: 'text.primary' },
} as const

export const pageTitleSx = {
  fontWeight: 600,
  letterSpacing: '-0.02em',
} as const

export const filterControlSx = {
  '& .MuiOutlinedInput-root': { borderRadius: 2 },
} as const

export const searchFieldSx = {
  width: '100%',
  '& .MuiOutlinedInput-root': { borderRadius: 2 },
} as const

export const quietChipSx = {
  fontWeight: 600,
  borderRadius: 1.5,
  height: 44,
  fontSize: '1.05rem',
} as const

export const kpiValueSx = {
  fontWeight: 600,
  fontSize: '2.75rem',
  lineHeight: 1.15,
  my: 1,
} as const

export const dataGridPaperSx = {
  minHeight: 520,
  width: '100%',
  backgroundColor: 'background.paper',
  borderRadius: 3,
  boxShadow: '0 8px 30px rgba(15, 23, 42, 0.06)',
  overflow: 'hidden',
  overflowX: 'auto',
} as const

export const codeBadgeSx = {
  flexShrink: 0,
  height: 40,
  borderRadius: 1.5,
  fontWeight: 700,
  fontSize: '1.05rem',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  letterSpacing: '0.01em',
  bgcolor: 'grey.100',
  color: 'text.primary',
} as const

export const dataGridProps = {
  disableColumnMenu: true,
  rowHeight: 108,
  columnHeaderHeight: 68,
} as const

export const dataGridSx = {
  border: 'none',
  minHeight: 520,
  '& .MuiDataGrid-columnHeaders': {
    backgroundColor: 'grey.50',
    borderBottom: '1px solid',
    borderColor: 'divider',
  },
  '& .MuiDataGrid-columnHeaderTitle': {
    fontSize: '1.05rem',
    fontWeight: 600,
    color: 'text.secondary',
    letterSpacing: '0.02em',
  },
  '& .MuiDataGrid-cell': {
    fontSize: '1.05rem',
    borderBottom: '1px solid',
    borderColor: 'divider',
    display: 'flex',
    alignItems: 'center',
    whiteSpace: 'normal',
    lineHeight: 1.3,
    py: 1,
  },
  '& .MuiDataGrid-row:hover': {
    backgroundColor: 'action.hover',
  },
  '& .MuiDataGrid-row.quiet-row .MuiDataGrid-cell': {
    color: 'text.disabled',
  },
  '& .MuiDataGrid-footerContainer': {
    borderTop: '1px solid',
    borderColor: 'divider',
    backgroundColor: 'background.paper',
  },
  '& .MuiDataGrid-columnSeparator': {
    display: 'none',
  },
} as const
