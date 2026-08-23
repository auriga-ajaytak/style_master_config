// Copyright (c) 2022, Sourabh and contributors
// For license information, please see license.txt

frappe.ui.form.on('Lab Testing Template', {
	// refresh: function(frm) {

	// }
	onload: function(frm) {
		frappe.ui.form.on("Lab Test Template Table",{			
			lab_test:function(frm, cdt, cdn){
			  var row = locals[cdt][cdn];
			  frappe.db.get_doc('Lab Tests', row.lab_test).then(doc=>{
				frappe.model.set_value(cdt, cdn, 'lab_testing_type', doc.lab_testing_type);
				frappe.model.set_value(cdt, cdn, 'lab_testing_category', doc.lab_testing_category);
			  });			  
				cur_frm.refresh_field('lab_test_table');
			},
			
		  });
		frappe.db.get_list('Lab Testing Category', {
			fields: ['lab_testing_category_name'],
		}).then(records => {
			if(records.length > 0){
				let tabData = [];
				console.log(frm.fields.lab_tests);
				let mainHtml = document.querySelector("lab_tests");
				let table = document.createElement('table');
				// console.log(mainHtml);
				records.forEach(function(recordData){
					// console.log(recordData.lab_testing_category_name);
					frappe.db.get_list('Lab Tests',{
						fields: ['lab_test_name','lab_testing_type'], 
						filters:{
							lab_testing_category:recordData.lab_testing_category_name
						}
					}).then(recData=>{
						// console.log(recData);
						if(recData.length > 0){
							// let data = Object.keys(tabData[0]);
							generateTableHead(table, ["Lab Test Name", "Lab Test Type", "Is Check"]);
							let row = table.insertRow();
							recData.forEach(function(rec){
								console.log(rec);
								let cell1 = row.insertCell();
								let text1 = document.createTextNode(rec.lab_test_name);
								cell1.appendChild(text1);
								let cell2 = row.insertCell();
								let text2 = document.createTextNode(rec.lab_testing_type);
								cell2.appendChild(text2);
								// let cell3 = row.insertCell();
								// let text3 = document.createElement('checkbox');
								// text3.name = 
								// cell3.appendChild(text3);
							});
							// mainHtml.html(table);
							console.log(mainHtml);
						}
					})
				});

				
				// frappe.db.get_list('Lab Tests',{
				// 	fields: [''],
				// })
			}
		})
		
	},
});


function generateTableHead(table, data) {
	let thead = table.createTHead();
	let row = thead.insertRow();
	for (let key of data) {
	  let th = document.createElement("th");
	  let text = document.createTextNode(key);
	  th.appendChild(text);
	  row.appendChild(th);
	}
  }
  

  function generateTable(table, data) {
	for (let element of data) {
	  let row = table.insertRow();
	  for (key in element) {
		let cell = row.insertCell();
		let text = document.createTextNode(element[key]);
		cell.appendChild(text);
	  }
	}
  }
  
