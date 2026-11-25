export const pageShellSx = {
  flexGrow: 1,
  width: '100%',
  maxWidth: 1280,
  mx: 'auto',
  px: 3,
  py: 3,
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
  minWidth: 280,
  maxWidth: 420,
  flex: '1 1 280px',
  '& .MuiOutlinedInput-root': { borderRadius: 2 },
} as const

export const quietChipSx = {
  fontWeight: 500,
  borderRadius: 1.5,
  height: 28,
} as const

export const dataGridPaperSx = {
  minHeight: 520,
  width: '100%',
  backgroundColor: 'background.paper',
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 2,
  overflow: 'hidden',
  overflowX: 'auto',
} as const

export const dataGridProps = {
  disableColumnMenu: true,
  rowHeight: 68,
  columnHeaderHeight: 52,
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
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'text.secondary',
    letterSpacing: '0.02em',
  },
  '& .MuiDataGrid-cell': {
    borderBottom: '1px solid',
    borderColor: 'divider',
    display: 'flex',
    alignItems: 'center',
    py: 0,
  },
  '& .MuiDataGrid-row:hover': {
    backgroundColor: 'action.hover',
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
