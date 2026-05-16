import { StyleSheet } from '@react-pdf/renderer';

export const reportStyles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 11, color: '#666', marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  statBox: { padding: 10, backgroundColor: '#f8f8f8', borderRadius: 4, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between' },
  statLabel: { fontSize: 9, color: '#666' },
  statValue: { fontSize: 14, fontWeight: 'bold' },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#ddd', paddingBottom: 4, marginBottom: 4 },
  tableHeaderText: { fontSize: 9, color: '#666', fontWeight: 'bold' },
  tableRow: { flexDirection: 'row', paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: '#eee' },
  tableCell: { fontSize: 9 },
  tableCellRight: { fontSize: 9, textAlign: 'right' },
  totalRow: { flexDirection: 'row', marginTop: 6, paddingTop: 6, borderTopWidth: 2, borderTopColor: '#333' },
  totalLabel: { fontWeight: 'bold', fontSize: 11 },
  totalValue: { fontWeight: 'bold', fontSize: 11, textAlign: 'right' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 8, color: '#999', textAlign: 'center' },
  green: { color: '#16a34a' },
  red: { color: '#dc2626' },
});
