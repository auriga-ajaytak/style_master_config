// Copyright (c) 2022, Sourabh and contributors
// For license information, please see license.txt

frappe.ui.form.on('Operation Bulletin', {

	validate: function(frm){
		frm.set_value(
			"operation_bulletin_data",
			JSON.stringify(frm.datatable.datamanager.data)
		);
		frm.set_value("removed_items", JSON.stringify(frm.removed_cat_array))
		if(frm.ob_order){
			frm.set_value("ob_order", JSON.stringify(frm.ob_order))
		}
		frm.set_value("exi_cat", JSON.stringify(frm.exi_cat))
		frm.set_value("row_values", JSON.stringify(frm.row_values))
	},
	update_table: function(frm){
		var dialog_fields = []
		frm.avl_cat = []
		if(frm.doc.removed_items){
			frm.removed_cat_array = JSON.parse(frm.doc.removed_items)
			frm.doc.removed_items = ""
		}
		frm.ob_order.forEach((dt)=>{
			dialog_fields.push({
				fieldtype: 'Check',
				fieldname: dt.label.toLowerCase().replace(" ", "_"),
				label: __(dt.label),
				default: frm.removed_cat_array.includes(dt.label) ? 0:1,
			})
		})
		frappe.db.get_list('Production Category',
			{fields: ['name', 'idx'],order_by: "creation asc",}).then((res) => {
			res.forEach((data, index) => {
				if(!frm.exi_cat.includes(data.name) && !frm.removed_cat_array.includes(data.name)){
					dialog_fields.push({
						fieldtype: 'Check',
						fieldname: data.name.toLowerCase().replace(" ", "_"),
						label: __(data.name),
						default: 0,
					})
				}
			});
			frm.rand_id = Math.floor(Math.random() * 1000000000 + 1);
			var ob_template = new frappe.ui.Dialog({
				title: 'Update OB Table',
				fields: [{
					fieldname: "ob_cat", 
					fieldtype: "HTML", 
					label: __("OB Cat"),
					options : frappe.render_template("operation_bulletin", {data: dialog_fields, rand_id:frm.rand_id }),
				}],
				primary_action_label: 'Apply',
				freeze: true,	
				primary_action(values) {
					const t0 = performance.now();
					frm.record = false
					var field_dict = []
					frm.ob_order = []
					frm.exi_cat = []
					frm.removed_cat_array = []
					frm.datatable.datamanager.data = []
					if(frm.temp_html_tab){
						
						for(var x=0; x<frm.temp_html_tab.length; x++){
			
							var operation_label = frm.temp_html_tab[x]["operation"].trim()
							if(frm.temp_html_tab[x].check_value == 1){
								frm.exi_cat.push(operation_label)
								field_dict.push({
									"category": operation_label,
									"lock_row": 1,
									"parent": operation_label,
								})
								if(frm.row_values[operation_label] && frm.row_values[operation_label].length > 0){
									for(var j=0; j<frm.row_values[operation_label].length; j++){
										var value = frm.row_values[operation_label][j]
										field_dict.push({
											"parent": operation_label,
											"category": value[0],
											"machine_type": value[1],
											"smv": value[2],
											"ssv":value[3],
											"h_target_hr":value[4],
											"s_target_hr":value[5],
											"day_target":value[6],
											"grade_value":value[7],
											"no_of_machines":value[8],
											"allocated_manpower":value[9],
											"total_grade":value[10],
											"rate_per_piece":value[11],
											"lock_row": 0,
										})
									}
								}else{
									field_dict.push({
										"parent": operation_label,
										"smv": 0.0,
										"ssv":0.0,
										"allocated_manpower":0.0,
										"h_target_hr":0.0,
										"s_target_hr":0.0,
										"day_target":0.0,
										"grade_value":0.0,
										"no_of_machines":0.0,
										"total_grade":0.0,
										"rate_per_piece":0.0,
										"lock_row": 0,
									})
									field_dict.push({
										"parent":operation_label,
										"category":"Total",
										"smv":0.0,
										"ssv":0.0,
										"allocated_manpower":0.0,
										"h_target_hr":0.0,
										"s_target_hr":0.0,
										"day_target":0.0,
										"grade_value":0.0,
										"no_of_machines":0.0,
										"total_grade":0.0,
										"rate_per_piece":0.0,
										"lock_row": 1,		
									})
								}	
							}else{
							frm.removed_cat_array.push(operation_label)
							frm.row_values[operation_label] = []
							}
							frm.ob_order.push({
								fieldtype: 'Check',
								fieldname: operation_label.toLowerCase().replace(" ", "_"),
								label: __(operation_label),
								default: frm.removed_cat_array.includes(operation_label) ? 0:1,
							})
						}
					}
					frm.load_datatable(field_dict)
					frm.dirty();
					ob_template.hide();
					frm.datatable.refresh(frm.datatable.datamanager.data);
					const t1 = performance.now();
					console.log(`update table took ${t1 - t0} milliseconds.`);	
				}
			});
			ob_template.show();
			frm.datatable.refresh(frm.datatable.datamanager.data);
		});
	},
	onload: function (frm) {
		frm.data_table_fields = []
		frm.ob_order = []
		frm.row_values = {}
		frm.record = true
		if(frm.doc.exi_cat){
			frm.exi_cat =  JSON.parse(frm.doc.exi_cat)
		}else{
			frm.exi_cat = []
		}
		frm.get_ob_details = function(tbl_data){
			if(frm.record){
				frm.ob_order = []
				tbl_data.forEach((row)=>{
					if(row.lock_row == 1 && row.category == "Total"){
						frm.ob_order.push({
							default: 1,
							fieldname: row.parent.toLowerCase().replace(" ", "_"),
							fieldtype: "Check",
							label: row.parent
						})
						frm.exi_cat.push(row.parent)
					}
				})
			}
		}
		frm.update_html_tbl = function(idx_ = false){
			frm.temp_html_tab = []
			frm.tes_dic = {}
			var myTab = document.getElementById('ob_table_'+frm.rand_id).rows
			var grid = document.getElementById('ob_table_'+frm.rand_id);
			var checkBoxes = grid.getElementsByTagName("INPUT");
			frm.removed_cat_array = []
			for(var i=0; i<myTab.length; i++){

				var ob_operation = document.getElementById('ob_table_'+frm.rand_id).rows[i].textContent.trim()
				frm.tes_dic[ob_operation] = checkBoxes[i].checked ? 1:0
				frm.temp_html_tab.push({
					"operation": ob_operation,
					"check_value": checkBoxes[i].checked ? 1:0,
					"idx_" : idx_
				})
				if(!checkBoxes[i].checked){
					frm.removed_cat_array.push(ob_operation)
				}	
			}
		}
		var row
		frm.start = function (){  
			row = event.target; 
		  }
		frm.dragover = function (){
			var e = event;
			e.preventDefault(); 
			let children= Array.from(e.target.parentNode.parentNode.children);
			if(children.indexOf(e.target.parentNode)>children.indexOf(row))
			  e.target.parentNode.after(row);
			else
			  e.target.parentNode.before(row);
			frm.update_html_tbl(true)
		}
		let sidebar_toggle = $('.page-head').find('.sidebar-toggle-btn');
		sidebar_toggle.click(()=>{
			frm.datatable.refresh(frm.datatable.datamanager.data);
		})
		frm.removed_cat_array = []
		frm.avl_cat = []

		frm.calculate_total = function(rowData, rowIndex, cat){
			frm.row_values[cat] = []
			var smv_total = 0.0;
			var ssv_total = 0.0;
			var h_target_hr_total = 0.0;
			var s_target_hr_total = 0.0;
			var day_target_total = 0.0;
			var grade_value_total = 0.0;
			var no_of_machines_total = 0.0;
			var allocated_manpower_total = 0.0;
			var total_grade_total = 0.0;
			var rate_per_piece_total = 0;
			while(true){
				if(rowData[rowIndex - 1].lock_row && rowData[rowIndex - 1].lock_row == 1){
					break;
				}
				rowIndex = rowIndex -1
			}
			for (var i =rowIndex; i<rowData.length; i++){
				if(rowData[i].lock_row == 0 && rowData[i].category !== "Total"){
					frm.row_values[rowData[i].parent].push(
						[
							rowData[i].category, rowData[i].machine_type, rowData[i].smv, rowData[i].ssv, rowData[i].h_target_hr, rowData[i].s_target_hr, 
							rowData[i].day_target, rowData[i].grade_value, rowData[i].no_of_machines, rowData[i].allocated_manpower, rowData[i].total_grade, 
							rowData[i].rate_per_piece
						]
						)
				}
				if(rowData[i].category == "Total"){
					var temp_smv = rowData[i].smv
					var temp_manpower = rowData[i].allocated_manpower
					var temp_h_target_hr = rowData[i].h_target_hr
					var temp_s_target_hr = rowData[i].s_target_hr
					var temp_total_rate = rowData[i].rate_per_piece

					rowData[i].smv = smv_total.toPrecision(2);
					rowData[i].ssv = ssv_total;;
					rowData[i].h_target_hr = h_target_hr_total;
					rowData[i].s_target_hr = s_target_hr_total;
					rowData[i].day_target = day_target_total;
					rowData[i].grade_value = grade_value_total;
					rowData[i].no_of_machines = no_of_machines_total;
					rowData[i].allocated_manpower = allocated_manpower_total;
					rowData[i].total_grade = total_grade_total;
					rowData[i].rate_per_piece = rate_per_piece_total.toPrecision(2);

					if(rowData[i].allocated_manpower > 0){
						if(rowData[i].no_of_machines > rowData[i].allocated_manpower){
							rowData[i-1].allocated_manpower = 0
							rowData[i].allocated_manpower = 0
							frm.datatable.refresh(frm.datatable.datamanager.data);
							frappe.throw(" Total number of machines should not exceed total number of allocated manpower")
						}
					}
					frm.row_values[rowData[i].parent].push(
						[
							rowData[i].category, rowData[i].machine_type, rowData[i].smv, rowData[i].ssv, rowData[i].h_target_hr, rowData[i].s_target_hr, 
							rowData[i].day_target, rowData[i].grade_value, rowData[i].no_of_machines, rowData[i].allocated_manpower, rowData[i].total_grade, 
							rowData[i].rate_per_piece
						]
						)
					
					frm.doc.gmt_smv = ((frm.doc.gmt_smv - temp_smv) + parseFloat(rowData[i].smv))
					frm.doc.total_manpower =  parseFloat(rowData[i].allocated_manpower)
					frm.doc.h_target__hour = ((frm.doc.h_target__hour - temp_h_target_hr) + parseFloat(rowData[i].h_target_hr))
					frm.doc.s_target__hour = ((frm.doc.s_target__hour - temp_s_target_hr) + parseFloat(rowData[i].s_target_hr))
					frm.doc.total_rate = ((frm.doc.total_rate - temp_total_rate) + parseFloat(rowData[i].rate_per_piece))

					frm.refresh_field("gmt_smv")
					frm.refresh_field("total_manpower")
					frm.refresh_field("h_target__hour")
					frm.refresh_field("s_target__hour")
					frm.refresh_field("total_rate")
					break
				}
				smv_total = smv_total + parseFloat(rowData[i].smv)
				ssv_total = ssv_total + parseFloat(rowData[i].ssv)
				h_target_hr_total = h_target_hr_total + parseFloat(rowData[i].h_target_hr)
				s_target_hr_total = s_target_hr_total + parseFloat(rowData[i].s_target_hr)
				day_target_total = day_target_total + parseFloat(rowData[i].day_target)
				grade_value_total = grade_value_total + parseFloat(rowData[i].grade_value)
				no_of_machines_total = no_of_machines_total + parseFloat(rowData[i].no_of_machines)
				allocated_manpower_total = allocated_manpower_total + parseFloat(rowData[i].allocated_manpower)
				total_grade_total = total_grade_total + parseFloat(rowData[i].total_grade)
				rate_per_piece_total = rate_per_piece_total + parseFloat(rowData[i].rate_per_piece)
				
			}
			frm.datatable.refresh(frm.datatable.datamanager.data);
		}
		frm.lock_category_rows = function(tbl_data){
			var idx = 0
			frm.doc.gmt_smv = 0
			frm.doc.total_manpower = 0
			frm.doc.h_target__hour = 0
			frm.doc.s_target__hour = 0
			frm.doc.total_rate = 0
			tbl_data.forEach((row, index) => {
				if(row.lock_row == 1 || row.category == "Total"){
					if(row.category !== "Total"){
						row.row_idx = index
					}
					if(row.category == "Total"){
						frm.doc.gmt_smv += parseFloat(row.smv)
						frm.doc.total_manpower += parseFloat(row.allocated_manpower)
						frm.doc.h_target__hour += parseFloat(row.h_target_hr)
						frm.doc.s_target__hour += parseFloat(row.s_target_hr)
						frm.doc.total_rate += parseFloat(row.rate_per_piece)
					}
					let row_classes = frm.datatable
					.getRows()
					.filter((row) => frm.check_row_closed(row))
					.map((row) => row.meta.rowIndex)
					.map((i) => `.dt-row-${index} .dt-cell`)
					.join(",");
					frm.datatable.style.setStyle(row_classes, {
						pointerEvents: "none",
						backgroundColor: frappe.ui.color.get_color_shade("#e9e9e9", "extra-light"),
						color:frappe.ui.color.get_color_shade("Black", "extra-light"),
						bold: true,
						fontSize: "12px",
						fontWeight: "bold"
					});
				}else{
					let row_classes = frm.datatable
					.getRows()
					.filter((row) => frm.check_row_closed(row))
					.map((row) => row.meta.rowIndex)
					.map((i) => `.dt-row-${index} .dt-cell`)
					.join(",");
					frm.datatable.style.setStyle(row_classes, {
						pointerEvents: true,
						backgroundColor: frappe.ui.color.get_color_shade(null),
						color:frappe.ui.color.get_color_shade(null, "extra-light"),
						bold: false,
						fontSize: "12px",
						fontWeight: "normal"
					});
					idx ++
					row.idx = idx
				}
			})
			$(`.${frm.datatable.style.scopeClass} .dt-scrollable`).css(
				"max-height",
				"none"
			  );
			  document.getElementsByClassName("dt-scrollable")[0].style.overflow=null
			frm.datatable.refresh(frm.datatable.datamanager.data);
			frm.refresh_field("gmt_smv")
			frm.refresh_field("total_manpower")
			frm.refresh_field("h_target__hour")
			frm.refresh_field("s_target__hour")
			frm.refresh_field("total_rate")
		}
		frm.unlock_rows = function(tbl_data){
			tbl_data.forEach((row, index) => {
				let row_classes = frm.datatable
				.getRows()
				.filter((row) => frm.check_row_closed(row))
				.map((row) => row.meta.rowIndex)
				.map((i) => `.dt-row-${index} .dt-cell`)
				.join(",");
				frm.datatable.style.setStyle(row_classes, {
					pointerEvents: true,
					backgroundColor: frappe.ui.color.get_color_shade(null),
				});				
			})
			document.getElementsByClassName("dt-scrollable")[0].style.overflow=null
			frm.datatable.refresh(frm.datatable.datamanager.data);
		}
		frm.check_row_closed = function (row) {
			let current_row = frm.datatable.datamanager.getData(row.meta.rowIndex);
			if (current_row.qty == current_row.received_qty) {
			  return true;
			} else {
			  return false;
			}
		  };
		frm.load_datatable = function (data) {
		  frm.$child_wrapper = frm.fields_dict.operation_bulletin_table.$wrapper;
		  frm.$child_wrapper.empty();
		  let random_id = Math.floor(Math.random() * 1000000000 + 1);
		  let $datatable_wrapper = $(
			`<div class="datatable-wrapper" id="${random_id}">`
		  );
		  frm.$child_wrapper.append($datatable_wrapper);
		  frm.datatable = new frappe.DataTable($datatable_wrapper.get(0), {
			columns: frm.make_columns(),
			data: data,
			getEditor: frm.get_editing_object.bind(frm),
			cellHeight: 35,
			width: "auto",
			layout: 'fixed', // fixed, fluid, ratio
			// inlineFilters: true,
			serialNoColumn: false,
			// checkboxColumn: true,
			noDataMessage: __("No Data"),
			disableReorderColumn: true,
			dynamicRowHeight: false,
			freezeMessage: 'updating...',
		});
		  frm.set_action_buttons(frm.datatable.datamanager.getRows());
		  frm.set_listeners();
		  frm.lock_category_rows(frm.datatable.datamanager.data)
		  if(frm.doc.__islocal){
			frm.get_ob_details(frm.datatable.datamanager.data)
			
		  }
		  document.getElementsByClassName("dt-scrollable")[0].style.overflow=null
		};
		frm.set_listeners = function () {
		  var me = frm;
		  $(`.${frm.datatable.style.scopeClass} .dt-scrollable`).on(
			"click",
			`.act-btn`,
			function () {
			  let row_id = parseInt($(this).attr("data-name"));
			  let btn_type = $(this).attr("data-btn-type");
			  let current_row = frm.datatable.datamanager.getData(row_id);
			  let columnFilters = frm.datatable.columnmanager.getAppliedFilters();
			  if (btn_type == "add-row") {
				frm.unlock_rows(frm.datatable.datamanager.data)
				let current_row_copy = {};
				current_row_copy.lock_row = 0
				current_row_copy.smv = 0.0
				current_row_copy.ssv = 0.0
				current_row_copy.h_target_hr = 0.0;
				current_row_copy.s_target_hr = 0.0;
				current_row_copy.day_target = 0.0;
				current_row_copy.grade_value = 0.0;
				current_row_copy.no_of_machines = 0.0;
				current_row_copy.allocated_manpower = 0.0;
				current_row_copy.total_grade = 0.0;
				current_row_copy.rate_per_piece = 0.0;
				current_row_copy.parent = current_row.parent;
				frm.datatable.datamanager.data.splice(row_id + 1, 0, current_row_copy);
				frm.datatable.datamanager.data.join()
				current_row.is_edited = 1;
				current_row.is_splited = 1;
				
				frm.datatable.refresh(frm.datatable.datamanager.data);
				frm.set_action_buttons(frm.datatable.datamanager.getRows());
				frm.dirty();
				$.find(
					".dt-filter",
					frm.datatable.columnmanager.header
				).forEach((input) => {
					input.value = columnFilters[input.dataset.colIndex] || "";
				});
				frm.datatable.columnmanager.applyFilter(columnFilters);
				frm.lock_category_rows(frm.datatable.datamanager.data);

			  } else if (btn_type == "delete") {
				frappe.confirm(
				  "Are you sure you want to delet this row?",
				  function () {
					if(calculate_total.lock_row && frm.datatable.datamanager.data[row_id - 1].lock_row  == 1
						&& frm.datatable.datamanager.data[row_id + 1].lock_row && frm.datatable.datamanager.data[row_id + 1].lock_row  == 1){
						frappe.throw("you cannot delete this row")
					}
					frm.unlock_rows(frm.datatable.datamanager.data)
					frm.datatable.datamanager.data.splice(
						
						row_id,
						1
					  );

					frm.datatable.refresh(frm.datatable.datamanager.data);
					frm.set_action_buttons(frm.datatable.datamanager.getRows());
					frm.dirty();
					$.find(
						".dt-filter",
						frm.datatable.columnmanager.header
					  ).forEach((input) => {
						input.value = columnFilters[input.dataset.colIndex] || "";
					  });
					  frm.datatable.columnmanager.applyFilter(columnFilters);
					  frm.calculate_total(frm.datatable.datamanager.data, row_id, frm.datatable.datamanager.data[row_id].category)
					frm.lock_category_rows(frm.datatable.datamanager.data);
				  },
				  function () {

				  }
				);
			  } 
			  return true;
			}
		  );
		};
		frm.set_action_buttons = function (rows) {
		  rows.forEach((row) => {
			let row_data = frm.datatable.datamanager.getData(row.meta.rowIndex);
			let temp_button = `
			<div class="inner-group-button" data-label="Status">
				  <button type="button" class="btn btn-default ellipsis btn-xs" data-toggle="dropdown" aria-haspopup="true"
					  aria-expanded="false" style="position: relative; bottom: 5px;">
					  <svg class="icon  icon-xs" style="position: relative;">
						  <use class="" href="#icon-setting-gear"></use>
					  </svg>
				  </button>
				  <div role="menu custom-actions-menu" class="dropdown-menu">
					  <button class="dropdown-item act-btn" data-name=${row.meta.rowIndex} data-btn-type='add-row'>Add Row</button>
					  <button class="dropdown-item act-btn" data-name=${row.meta.rowIndex} data-btn-type='delete'>Delete</button>
				  </div>
			  </div>
			`;
			let actions = `
			  <div class="inner-group-button" data-label="Status">
				  <button type="button" class="btn btn-default ellipsis btn-xs" data-toggle="dropdown" aria-haspopup="true"
					  aria-expanded="false">
					  <svg class="icon  icon-xs" style="">
						  <use class="" href="#icon-setting-gear"></use>
					  </svg>
				  </button>
				  <div role="menu custom-actions-menu" class="dropdown-menu">
					  <button class="dropdown-item act-btn" data-name=${row.meta.rowIndex} data-btn-type='add-row'>Add Row</button>
					  <button class="dropdown-item act-btn" data-name=${row.meta.rowIndex} data-btn-type='delete'>Delete</button>
				  </div>
			  </div>
			  `;
			// row_data.actions = actions;
			row_data.temp_button = temp_button
		  });
		  frm.datatable.refresh(frm.datatable.datamanager.data);
		};
		frm.datatable_columns = [
			{
			fieldname: "idx",
			label: "No.",
			fieldtype: "Int",
			editable: false,
			bold:1,
			align: 'center'
			},
			{
			fieldname: "category",
			label: "Operation",
			fieldtype: "Link",
			options: "Operation",
			editable: true,
			bold:1,
			align: 'left',
			width: 150,
			},
		  {
			fieldname: "machine_type",
			label: "Machine Type",
			fieldtype: "Link",
			options: "Machine Type",
			editable: true,
			align: 'left',
			width: 150,
		  },
		  {
			fieldname: "ssv",
			label: "SSV (Sec)",
			fieldtype: "Float",
			default:0.0,
			precision:3,
			editable: true,
			align: 'center',
		  },
		  {
			fieldname: "smv",
			label: "SMV (Min)",
			fieldtype: "Float",
			precision:3,
			editable: false,
			align: 'center',
		  },
		  
		  {
			fieldname: "h_target_hr",
			label: "100% Target/Hr",
			fieldtype: "Float",
			precision:3,
			default:0,
			editable: false,
			align: 'center',
		  },
		  {
			fieldname: "s_target_hr",
			label: "70% Target/Hr",
			fieldtype: "Int",
			default:0,
			editable: false,
			align: 'center',
		  },
		  {
			fieldname: "day_target",
			label: "Day Target(8Hrs)",
			fieldtype: "Int",
			default:0,
			editable: false,
			align: 'center',
		  },
		  {
			fieldname: "oper_grade",
			label: "Operator Grade",
			fieldtype: "Link",
			options: "Employee Grade",
			editable: true,
			align: 'left',
		  },
		  {
			fieldname: "grade_value",
			label: "Ind'l Grade Value(in INR)",
			fieldtype: "Float",
			default:0.0,
			editable: true,
			align: 'center',
		  },
		  {
			fieldname: "no_of_machines",
			label: "No of Machines",
			fieldtype: "Int",
			default:0,
			editable: true,
			align: 'center',
		  },
		  {
			fieldname: "allocated_manpower",
			label: "Allocated Manpower",
			fieldtype: "Float",
			default:0,
			editable: true,
			align: 'center',
		  },
		  {
			fieldname: "total_grade",
			label: "Total Grade Value(in INR)",
			fieldtype: "Float",
			default:0.0,
			editable: false,
			align: 'center',
		  },
		  {
			fieldname: "rate_per_piece",
			label: "Rate per Piece",
			fieldtype: "Float",
			default:0,
			precision:2,
			editable: false,
			align: 'center',
		  },
		];
		frm.make_columns = function () {
		  let columns = [];
		  columns.push({
			id: "temp_button",
			name: "Actions",
			editable: true,
			sortable: true,
			focusable: true,
			dropdown: false,
			align: "center",
			// height:35
		  })
		  frm.datatable_columns.forEach((column) => {
			columns.push({
			  id: column.fieldname,
			  name: column.label,
			  dropdown: false,
			  align: column.align,
			  width: column.width,
			  docfield: column,
			  editable: column.editable,
			  overflow:null,
			  precision: column.precision,
			  focusable: column.fieldtype=='HTML' ? false : true
			});
		  });
		  //action buttons
		//   columns.push({
		// 	id: "actions",
		// 	name: "Actions",
		// 	editable: true,
		// 	sortable: true,
		// 	focusable: true,
		// 	dropdown: false,
		// 	align: "center",
		//   });
		  return columns;
		};
		frm.render_editing_input = function (colIndex, value, parent) {
		  const col = frm.datatable.getColumn(colIndex);
		  let control = null;
	
		  if (col.docfield.fieldtype === "Text Editor") {
			const d = new frappe.ui.Dialog({
			  title: __("Edit {0}", [col.docfield.label]),
			  fields: [col.docfield],
			  primary_action: () => {
				frm.datatable.cellmanager.submitEditing();
				frm.datatable.cellmanager.deactivateEditing();
				d.hide();
			  },
			});
			d.show();
			control = d.fields_dict[col.docfield.fieldname];
		  } else {
			// make control
			control = frappe.ui.form.make_control({
			  df: col.docfield,
			  parent: parent,
			  render_input: true,
			});
			control.set_value(value);
			control.toggle_label(false);
			control.toggle_description(false);
		  }
	
		  return control;
		};
		frm.get_editing_object = function (colIndex, rowIndex, value, parent) {
		  const control = frm.render_editing_input(colIndex, value, parent);
		  if (!control) return false;
	
		  control.df.change = () => control.set_focus();
	
		  return {
			initValue: (value) => {
			  return control.set_value(value);
			},
			setValue: (value) => {
			  const cell = frm.datatable.getCell(colIndex, rowIndex);
			  if (value != cell.content) {
				let row_data = frm.datatable.datamanager.getData(rowIndex);
				row_data[cell.column.id] = value;
				row_data.is_edited = 1;
				row_data.is_splited = 0;
				if (row_data.ssv){
					row_data.h_target_hr = Math.floor( Math.round (3600 / row_data.ssv));
					row_data.smv = (row_data.ssv / 60).toPrecision(2)
					
					row_data.s_target_hr = Math.floor(  Math.round(row_data.h_target_hr * 0.75));
					row_data.day_target = Math.floor(  Math.round(row_data.s_target_hr * 8));
				}
				if (row_data.grade_value && row_data.allocated_manpower){
					row_data.total_grade = Math.floor( Math.round(row_data.grade_value * row_data.allocated_manpower));
				}
				if(row_data.s_target_hr && row_data.grade_value){
					row_data.rate_per_piece = (row_data.s_target_hr / row_data.grade_value).toPrecision(2);
					frm.datatable.refresh(frm.datatable.datamanager.data);
				}
				
				var cat = frm.datatable.datamanager.data[rowIndex].parent
				
				
				frm.calculate_total(frm.datatable.datamanager.data, rowIndex, cat)
				// frm.store_row_value(frm.datatable.datamanager.data)
			  }
			  frm.datatable.refresh(frm.datatable.datamanager.data);
			  frm.dirty();
			  document.getElementsByClassName("dt-scrollable")[0].style.overflow=null
			  return control.set_value(value);
			},
			getValue: () => {
			  return control.get_value();
			},
		  };
		};
	  },
	  refresh: function (frm) {
		if (frm.doc.operation_bulletin_data) {
			frm.record = false
		  frm.load_datatable(JSON.parse(frm.doc.operation_bulletin_data));
		}
		else{
			get_operation_details(frm)
		}
		if(frm.doc.ob_order){
			frm.ob_order =  JSON.parse(frm.doc.ob_order)
		}
		if(frm.doc.row_values){
			frm.row_values = JSON.parse(frm.doc.row_values)
		}
	  },
  });
  
  function get_operation_details(frm){
		  frappe.call({
			  doc: frm.doc,
			  method: "load_category",
			  callback: function (r) {
				  if (r.message){
					frm.load_datatable(r.message)
				  }
				  else{
					  frm.set_value("operation_bulletin_data","")
					  frappe.msgprint("No Records found for production category")
				  }
			  },
		  })
	  
  };
  

	
