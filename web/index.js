import "@vaadin/date-picker";

const table = new Handsontable(document.querySelector("#table"), {
  colHeaders: ["Movie", "Gross", "Shows", "Occupancy"],
  data: [["2018", "1,00,000₹", "1,000 (15HF)", "50% (1,000/3,000)"]],
  licenseKey: "non-commercial-and-evaluation",
  manualColumnResize: true,
  manualRowMove: true,
  minRows: 200,
  minSpareCols: 1,
  minSpareRows: 1,
  multiColumnSorting: true,
  rowHeaders: true,
  stretchH: "all",
});

table.refreshDimensions();
