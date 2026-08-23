frappe.ui.form.on('Item', {
    refresh:function(frm){        
        if(!frm.is_new() && frm.doc.item_group !== ''){
            set_item_sub_group(frm);
            set_item_group_category(frm);
        }
        showHideFixedAssetsCheck(frm);
        // get_fabric_segment(frm);
        
        frm.set_df_property('naming_series','hidden',1);
        frm.set_df_property('item_code','hidden',1);
        frm.set_df_property('fabric_color','hidden',1);
        frm.set_df_property('item_code','reqd',0);

        Object.keys(frm.html_datatable_arr).forEach(function(value, index, array){
            frm.get_docwise_columns(value); // setup table columns
            setTimeout(function(){
                frm.setupDataTable(value, index, array); 
            },2000);            
        });
    },
    after_save:function(frm){
        let successStr = 'Item created successfully.';
        if(frm.doc.item_code !== ''){
            successStr += ' Item Code - '+frm.doc.item_code;
        }
        if(frm.doc.item_group_category == 'Fabric' && frm.doc.fabric_description !== ''){
            successStr += ' Item Description - '+frm.doc.fabric_description;
        }
        if(frm.doc.item_group_category == 'Trims' && frm.doc.trim_description !== ''){
            successStr += ' Item Description - '+frm.doc.trim_description;
        }

        if(successStr !== ''){
            frappe.msgprint(successStr);
        }
    },
    updateCoreTable: function (frm){
        if(frm.process_route_settings > 0){
            frm.setup_process_route_data(frm);
            frm.process_route_settings = 0;
        }
        let htmlTableData = frm.datatable[frm.setuptablename].datamanager.data;
        let doctable = frm.html_datatable_arr[frm.setuptablename]['table'];
        if(typeof frm.is_new() == 'undefined'){    
            frm.doc[doctable] = [];    
        }
        frm.clear_table(doctable);
        // console.log(doctable);
        htmlTableData.forEach(function(eh){
            let row = frm.add_child(doctable, eh);
        });
        frm.refresh_field(doctable);

        if(frm.executeCosting > 0){
            frm.getCostingTable(frm);
            frm.executeCosting = 0;
          }
    },
    onload:function(frm){
        show_fabric_fields(frm);
        
        frm.fields_dict['item_group'].get_query = function(doc, cdt, cdn) {
			return {
				filters: [
					['Item Group', 'parent_item_group', '=', "All Item Groups"],
                    ['Item Group', 'docstatus', '!=', 2]
				]
			}
		}

        frm.fields_dict['brand'].get_query = function(doc, cdt, cdn) {
			return {
				filters: [
					['Brand', 'is_customer_brand', '!=', 1]
				]
			}
		}

        frappe.ui.form.on("Fabric Composition",{
            fabric_composition_add:function(frm, cdt,cdn){
                fill_composition_field(frm);
            },
            fabric_content:function(frm, cdt, cdn){
                fill_composition_field(frm);
            },
            fabric_percentage:function(frm, cdt, cdn){
                fill_composition_field(frm);
            }
        });

        frappe.ui.form.on("Item Reference", {
            item_reference_add:function(frm,cdt,cdn){
                if(frm.doc.item_reference.length > 2){
                    cur_frm.get_field('item_reference').grid.grid_rows[2].remove();
                    frappe.msgprint(__("User can add maximum 2 rows in Item reference table."));
                    validated = false;
                }

                set_fabric_description(frm);   
            },
            reference_name:function(frm, cdt, cdn){
                set_fabric_description(frm);
            },
            reference_value:function(frm, cdt, cdn){
                set_fabric_description(frm);
            }
        });

        frm.process_route_settings = 0; // for display settings.
        frm.datatable = {}	
        frm.datatable_columns = {};
        frm.html_datatable_arr = {            
            'fabric_process_route':{
                'doctypeKey':'fabric_process_route',
                'table':'fabric_process_routes',
                'doctype':'Fabric Process Route',
                'html_table':'fabric_process_route_html_table',
                'table_buttons':'fabric_process_route_buttons',
                'parentTable':'item'
            },
            // 'trims_process_route':{
            //     'doctypeKey':'trims_process_route',
            //     'table':'trims_process_route_table',
            //     'doctype':'Trims Process Route',
            //     'html_table':'trims_process_route_html_table',
            //     'table_buttons':'trims_process_route_html_buttons',
            //     'parentTable':'trims'                
            // }
        }
        
        frm.blank_row = false;			
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
			// frm.update_html_tbl(true)
		}
		let sidebar_toggle = $('.page-head').find('.sidebar-toggle-btn');
		sidebar_toggle.click(()=>{
			// frm.datatable.refresh(frm.datatable.datamanager.data);
		});

        frm.load_datatable = function (data) {
            let dynamic_html_table = frm.html_datatable_arr[frm.setuptablename]['html_table']; // html field
            let dynamic_doctype_field = frm.html_datatable_arr[frm.setuptablename]['table']; // doctype table field name
            let dynamic_doctype_table = frm.setuptablename; // doctype table name
           frm.$child_wrapper = frm.fields_dict[dynamic_html_table].$wrapper;
           frm.$child_wrapper.empty();
           let random_id = Math.floor(Math.random() * 1000000000 + 1);
           let $datatable_wrapper = $(
             `<div class="datatable-wrapper" id="${random_id}">`
           );
           
           let table_columns = frm.make_columns(dynamic_doctype_table);
           
           frm.$child_wrapper.append($datatable_wrapper);
           frm.datatable[dynamic_doctype_table] = new frappe.DataTable($datatable_wrapper.get(0), {
             columns: table_columns,
             data: data,
             getEditor: frm.get_editing_object.bind(frm),
             cellHeight: 35,
             width: "auto",
             layout: 'fixed', // fixed, fluid, ratio
             // inlineFilters: true,
             serialNoColumn: true,
             checkboxColumn: true,
             noDataMessage: __("No Data"),
             disableReorderColumn: true,
             dynamicRowHeight: false,
             freezeMessage: 'updating...',
             checkedRows:[],
             getCheckedRows: ()=>{
                 return this.datatable[dynamic_doctype_table].rowmanager
                     .getCheckedRows()
                     .map(i => parseInt(i, 10));
             },
             events:{
                 onCheckRow:(row) => {
                     // console.log($(row).closest('.frappe-control'));
                     frm.setup_action_buttons(frm.setuptablename);
                 }
             }
             
         });
               
           frm.set_listeners(dynamic_doctype_table);
           if(frm.doc.__islocal){
         // 	frm.get_ob_details(frm.datatable.datamanager.data)			
           }
           document.getElementsByClassName("dt-scrollable")[0].style.overflow=null
           frm.refresh_field(dynamic_html_table);
           frm.datatable[dynamic_doctype_table].refresh();
         }

         frm.setup_action_buttons = (dynamic_doctype_table) =>{
            // console.log(dynamic_doctype_table);
            let checkedRows = frm.datatable[dynamic_doctype_table].options.getCheckedRows();
            let hidden = 'none';
            if(checkedRows.length > 0){
                hidden = '';
            }

            $('#delete_row_'+dynamic_doctype_table).removeClass('hidden');
            if(hidden !== ''){
                $('#delete_row_'+dynamic_doctype_table).addClass('hidden');
            }
        }
        
        
		frm.set_listeners = function (dynamic_doctype_table) {
            $("#delete_row_"+dynamic_doctype_table).on("click",()=>{ 
                frm.deleteRow(frm,dynamic_doctype_table);            
            });
            $("#add_row_"+dynamic_doctype_table).on("click",()=>{ 
                // console.log("In add row");
                // console.log(dynamic_doctype_table);
                frm.addRow(frm,dynamic_doctype_table);            
            });
		};
		

        frm.get_docwise_columns = function(doctypename) {            
            frappe.call({
                method: "style_master_costing.queries.get_doc_wise_columns",
                args: {'doctypename':doctypename},
                callback: function(r) {
                    if(typeof r.message !== 'undefined' && typeof r.message.fields !== 'undefined'){
                        if(r.message.fields.length > 0){
                            frm.datatable_columns[doctypename] = r.message.fields;                        
                        }
                    }
                }
            });
        }
		
		frm.make_columns = function (doctypename) {
			let columns = [];
            
            frm.datatable_columns[doctypename].forEach((column) => {
                if(column.in_list_view == 1 && (typeof column.hidden == 'undefined' || column.hidden == 0)){
                    if(column.fieldname == 'fabric_name'){
                        column.get_query = "style_master_costing.queries.fabric_item_group_wise_items"                        
                    }
                    if(column.fieldname == 'trim_name'){
                        column.get_query = "style_master_costing.queries.trims_item_group_wise_items"
                    }
                    if(column.fieldname == 'component'){
                        column.options = [""];
                    }
                    
                    let col_data = {
                        id: column.fieldname,
                        name: column.label,
                        dropdown: false,
                        align: 'center',
                        width: column.width,
                        docfield: column,
                        editable: true,
                        overflow:null,
                        precision: typeof column.precision !== 'undefined' ? column.precision : false,
                        focusable: column.fieldtype=='HTML' ? false : true
                    }
                    if(typeof column.width !== 'undefined')
                        col_data.width = column.width

                   
                    columns.push(col_data);
                }
            });
			return columns;
		};
		frm.render_editing_input = function (colIndex, value, parent, dynamic_doctype_table) {
		  const col = frm.datatable[dynamic_doctype_table].getColumn(colIndex);
		  let control = null;
	
        
        if(frm.doc.is_set > 0 && col.docfield.fieldname == 'component'){			
            let component = [];
            if(typeof frm.doc.style_component !== 'undefined' && frm.doc.style_component !== 'undefined'){
                if(frm.doc.style_component.length > 0){
                    frm.doc.style_component.forEach(function(cmt){
                        component.push(cmt.component_name);
                    });
                    col.docfield.options = [""].concat(component);
                }
            }
        }

		  if (col.docfield.fieldtype === "Text Editor") {
			const d = new frappe.ui.Dialog({
			  title: __("Edit {0}", [col.docfield.label]),
			  fields: [col.docfield],
			  primary_action: () => {
				frm.datatable[dynamic_doctype_table].cellmanager.submitEditing();
				frm.datatable[dynamic_doctype_table].cellmanager.deactivateEditing();
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
          let own_datatable_html = $(parent).closest('.frappe-control').attr('data-fieldname');
          let obj = Object.keys(frm.html_datatable_arr).find((o, i) => {
            if(frm.html_datatable_arr[o].html_table == own_datatable_html){
                frm.setuptablename = o;
            }
            // if (o.name === 'string 1') {
            //     arr[i] = { name: 'new string', value: 'this', other: 'that' };
            //     return true; // stop searching
            // }
          });
		  const control = frm.render_editing_input(colIndex, value, parent, frm.setuptablename);
		  if (!control) return false;
	
		  control.df.change = () => control.set_focus();
	
		  return {
			initValue: (value) => {
			  return control.set_value(value);
			},
			setValue: (value) => {
              frm.executeCosting = 0;
			  const cell = frm.datatable[frm.setuptablename].getCell(colIndex, rowIndex);
			  if (value != cell.content) {                
				let row_data = frm.datatable[frm.setuptablename].datamanager.getData(rowIndex);
                // var cat = frm.datatable[frm.setuptablename].datamanager.data[rowIndex].parent
                
				row_data[cell.column.id] = value;
				row_data.is_edited = 1;
				row_data.is_splited = 0;
                if(cell.column.id == 'fabric_name' || cell.column.id == 'trim_name'){
                    frappe.db.get_doc('Item', row_data[cell.column.id]).then(doc=>{
                        row_data['category'] = doc.item_sub_group;
                        row_data['hs_code'] = doc.gst_hsn_code;
                        row_data['description'] = doc.composition;
                        row_data['unit'] = doc.stock_uom;
                      });
                       
                      frm.datatable[frm.setuptablename].refresh(frm.datatable[frm.setuptablename].datamanager.data);
                }
                if(cell.column.id == 'fabric_type' || cell.column.id == 'trims_type'){
                    frm.process_route_settings = 1; // set this settings to 1 when load process route table once.
                }
                const update_qty_columns = ['garment_qty','trims_qty','consumption','purchase_extra','production_extra','garment_wastage','trims_wastage','sample_qty'];                
                if(update_qty_columns.indexOf(cell.column.id) !== -1){
                    if(frm.setuptablename == 'fabric')
                        frm.calulateFabricTableTotalRowQty(row_data);
                    if(frm.setuptablename == 'trims')
                        frm.calulateTrimsTableTotalRowQty(row_data);
                }

                const update_price_columns = ['rate_our','rate_buyer','insurance_amt','freight_based_on','freight_with_gst','import_duty','handling_charges','gst_percent'];
                if(update_price_columns.indexOf(cell.column.id) !== -1){
                    if(frm.setuptablename == 'fabric')
                        frm.calculateFabricTableTotalRow(row_data);
                    if(frm.setuptablename == 'trims')
                        frm.calculateTrimsTableTotalRow(row_data);
                    
                    frm.executeCosting = 1;
                }

                if(cell.column.id == 'loss_percent'){
                    let reqd_input_qty = 0;
                    let finish_reqd_qty = row_data.finish_reqd_qty;

                    if(finish_reqd_qty > 0){
                        reqd_input_qty = (finish_reqd_qty/((100 - row_data.loss_percent)/100));
                        row_data.reqd_input_qty = frm.round(reqd_input_qty, 2);
                    }
                }
                if(cell.column.id == 'process_rate'){
                    let total_input_rate = 0;
                    let process_rate = row_data.process_rate;
                    let reqd_input_qty = row_data.reqd_input_qty;
                    let finish_reqd_qty = row_data.finish_reqd_qty;
                    let calculated_rate = 0;
                    if(process_rate > 0){
                        calculated_rate = (reqd_input_qty * process_rate);
                        total_input_rate = (calculated_rate / finish_reqd_qty)
                    }
                    row_data.total_input_rate = frm.round(total_input_rate, 2);
                }
                if(cell.column.id == 'item_rate'){
                    let total_input_rate = 0;
                    let item_rate = row_data.item_rate;
                    let reqd_input_qty = row_data.reqd_input_qty;
                    let finish_reqd_qty = row_data.finish_reqd_qty;
                    let calculated_rate = 0;
                    if(item_rate > 0){
                        calculated_rate = (reqd_input_qty * item_rate);
                        total_input_rate = (calculated_rate / finish_reqd_qty)
                    }
                    row_data.total_input_rate = frm.round(total_input_rate, 2);
                }
			  }
              cur_frm.trigger('updateCoreTable');
			  frm.datatable[frm.setuptablename].refresh(frm.datatable[frm.setuptablename].datamanager.data);              
			  frm.dirty();
			  document.getElementsByClassName("dt-scrollable")[0].style.overflow=null
            //   console.log(value);
			  return control.set_value(value);
			},
			getValue: () => {
			  return typeof control.get_value() !== 'undefined' ? control.get_value() : '';
			},
            
		  };
		},
        frm.deleteRow = function(frm, dynamic_doctype_table){
            frappe.confirm(
                "Are you sure you want to delete this row?",
                function () {
                    let row_id = frm.datatable[dynamic_doctype_table].options.getCheckedRows();
                    // console.log(row_id);
                    for(let i=0;i<row_id.length;i++){
                        frm.datatable[dynamic_doctype_table].rowmanager.checkRow(row_id[i],0);
                    frm.datatable[dynamic_doctype_table].datamanager.data.splice(
                        
                        row_id[i],
                        1
                        );                        
                        frm.datatable[dynamic_doctype_table].refresh(frm.datatable[dynamic_doctype_table].datamanager.data);
                    }
                    
                    frm.setup_action_buttons(dynamic_doctype_table);
                    // frm.dirty();
                    frm.datatable[dynamic_doctype_table].refresh(frm.datatable[dynamic_doctype_table].datamanager.data);
                },
                function () {
                    // console.log($(this));
                }
              );
        }
        frm.addRow = function(frm, table_name){
            
            let blank_obj = {};
            frm.datatable_columns[table_name].forEach((column) => {
                
                if(column.in_list_view == 1 && (typeof column.hidden == 'undefined' || column.hidden == 0)){
                    var fieldn = column.fieldname;  
                    if(column.fieldname == 'garment_qty' || column.fieldname == 'trims_qty'){
                        blank_obj[fieldn] = frm.doc.garment_qty;
                        
                    }
                    // else if(column.fieldname == 'fabric_name' && table_name == 'fabric_process_route'){
                    //     blank_obj[fieldn] = frm.doc.fabric_for_process;
                    // }
                    // else if(column.fieldname == 'trim_name' && table_name == 'trims_process_route'){
                    //     blank_obj[fieldn] = frm.doc.trims_for_process;
                    // }
                    else                                        
                        blank_obj[fieldn] = '';     
                        
                        
                }
            }
            
            );
            
            // if(table_name == 'fabric_process_route' || table_name == 'trims_process_route'){                
            //     if(typeof frm.doc[frm.html_datatable_arr[frm.html_datatable_arr[table_name]['parentTable']]['table']] !== 'undefined'){
            //         frm.doc[frm.html_datatable_arr[frm.html_datatable_arr[table_name]['parentTable']]['table']].forEach(function(fb){  
            //             if((typeof fb.fabric_type !== 'undefined' && fb.fabric_type == 'Process') || (typeof fb.trims_type !== 'undefined' && fb.trims_type == 'Process')){                        
            //                 blank_obj['finished_cons'] = fb.consumption;
            //                 blank_obj['finished_rate'] = fb.rate_our;
            //                 blank_obj['finish_reqd_qty'] = fb.total_req_qty;
            //             }
            //         });
            //     }
            // }
            

            if(!frm.blank_row){    
                // console.log(frm.datatable[table_name].datamanager.data.length);                          
                frm.datatable[table_name].datamanager.data.splice(frm.datatable[table_name].datamanager.data.length + 1, 0, blank_obj);
                frm.datatable[table_name].datamanager.data.join()
                blank_obj.is_edited = 1;
                blank_obj.is_splited = 1;
                
                frm.datatable[table_name].refresh(frm.datatable[table_name].datamanager.data);
                frm.dirty();
            }
            else{
                return blank_obj;
            }
        }
       

        frm.setupDataTable = function(docname, index, array){
            frm.setuptablename = docname;
            let table_name = frm.html_datatable_arr[docname]['table'];
            var data_rows = [];
            
            
            if(frm.doc[table_name] !== 'undefined'){
                data_rows = frm.doc[table_name];
            }
            
            if(typeof data_rows == 'undefined'){
                // console.log('Manish');
                var data_rows = [];
                frm.blank_row = true;
                let blank_obj = frm.addRow(frm, docname);
                data_rows.push(blank_obj);
                frm.blank_row = false;
            }
            frm.load_datatable(data_rows);
      }
      frm.setup_process_route_data = (frm) =>{
            let route_data = [];
			let readonly = 1;
			
            let display_div = '';
            let display_select = '';
			if(typeof frm.doc[frm.html_datatable_arr[frm.setuptablename]['table']] !== 'undefined'){
				// frm.clear_table('process_route_table');
                let htmlTableData = frm.datatable[frm.setuptablename].datamanager.data;
				htmlTableData.forEach(function(prs){
					
					if((typeof prs.fabric_type !== 'undefined' && prs.fabric_type == 'Process')){
						readonly = 0;
						route_data.push(prs.fabric_name);
                        display_select = 'fabric_for_process';
                        display_div = 'fabric_process_route_details';
					}
                    else if(typeof prs.trims_type !== 'undefined' && prs.trims_type == 'Process'){
                        readonly = 0;
						route_data.push(prs.trim_name);
                        display_select = 'trims_for_process';
                        display_div = 'trims_process_route_details';
                    }
				});
				
                if(frm.html_datatable_arr[frm.setuptablename]['parentTable'] == 'fabric')
				    frm.showProcessRoute(frm);
                if(frm.html_datatable_arr[frm.setuptablename]['parentTable'] == 'trims')
                    frm.showTrimsProcessRoute(frm);

				frm.set_df_property(display_select, 'options', [""].concat(route_data));
				frm.set_df_property(display_select, 'read_only', readonly);
			}
			
			frm.toggle_display(display_div, readonly == 0);
			frm.refresh_field(frm.html_datatable_arr[frm.setuptablename]['table']);
      }

       frm.round = (num, decimalPlaces = 0) => {
            num = Math.round(num + "e" + decimalPlaces);
            return Number(num + "e" + -decimalPlaces);
        }
    },
    item_sub_group:function(frm){
        set_item_group_category(frm);
    },
    fabric_structure:function(frm){
        setupFabricFieldsBySegment(frm);
        // get_fabric_segment(frm);
        set_fabric_description(frm);
    },
    fabric_segment:function(frm){
        let readOnly = 0;
        let hiddenProperty = 1;
        if(frm.doc.fabric_segment == 'Open Width'){
            frm.doc.width_type = 'Open Width';
            readOnly = 1;
            hiddenProperty = 0;
        }
        else if(frm.doc.fabric_segment == 'Tubular'){
            frm.doc.width_type = 'Dia';
            readOnly = 1;
        }
        frm.set_df_property('width_type','read_only', readOnly);
        frm.set_df_property('finished_width','hidden',hiddenProperty);
        frm.refresh_field('width_type');
        frm.refresh_field('finished_width');
        set_fabric_description(frm);
    },
    composition:function(frm){
        set_fabric_description(frm);
    },
    count_and_gauge:function(frm){
        set_fabric_description(frm);
    },
    gauge:function(frm){
        set_fabric_description(frm);
    },
    weave_structure:function(frm){
        set_fabric_description(frm);
    },
    construction:function(frm){
        set_fabric_description(frm);
    },
    item_group_category:function(frm){
        showHideFixedAssetsCheck(frm);
    },
    warp_count:function(frm){
        set_fabric_description(frm);
    },
    weft_count:function(frm){
        set_fabric_description(frm);
    },
    read_on_table:function(frm){
        set_fabric_description(frm);
    },
    pick_on_table:function(frm){
        set_fabric_description(frm);
    },
    finished_width:function(frm){
        set_fabric_description(frm);
    },
    cuttable_width:function(frm){
        set_fabric_description(frm);
    },
    gsm:function(frm){
        set_fabric_description(frm);
    },
    select_fabric_color:function(frm){
        set_fabric_description(frm);
    },
    design:function(frm){
        set_fabric_description(frm);
    },
    special_process:function(frm){
        set_fabric_description(frm);
    },
    buyer_short_code:function(frm){
        set_fabric_description(frm);
    },
    fabric_direction:function(frm){
        set_fabric_description(frm);
    },
    type_of_fabric:function(frm){
        set_fabric_description(frm);
    },
    width_type:function(frm){
        set_fabric_description(frm);
    },
    count_and_gauge:function(frm){
        set_fabric_description(frm);
    },
    gauge:function(frm){
        set_fabric_description(frm);
    },
    knitting_dia:function(frm){
        set_fabric_description(frm);
    },
    trim_color:function(frm){
        set_fabric_description(frm);
    }
});

function showHideFixedAssetsCheck(frm){
    let hidden = 0;
    if(frm.doc.item_group_category == 'Fabric' || frm.doc.item_group_category == 'Trims'){
        hidden = 1;
    }
    frm.set_df_property("is_fixed_asset", "hidden", hidden);
}

function get_item_reference_string(frm){
    let item_reference_string = '';
    if(typeof frm.doc.item_reference !== 'undefined' && frm.doc.item_reference !== 'undefined'){
        frm.doc.item_reference.forEach(function(cst){
            // console.log(typeof cst.fabric_content);
            if(typeof cst.reference_name !== 'undefined' && cst.reference_name !== '')
                item_reference_string +=  cst.reference_name + ' ';
            if(typeof cst.reference_value !== 'undefined' && cst.reference_value !== '')
                item_reference_string += cst.reference_value + ' '        
        });
    }

    return item_reference_string;
}
function set_fabric_description(frm){
    let fabric_description_string = '';

    if(frm.doc.item_group_category == 'Trims'){
        // if(typeof frm.doc.item_name !== 'undefined' && frm.doc.item_name !== 'undefined' && frm.doc.item_name !== ''){
        //     fabric_description_string += frm.doc.item_name + ' ';
        // }
        fabric_description_string += frm.doc.item_group+' ';
        if(typeof frm.doc.trim_composition !== 'undefined' && frm.doc.trim_composition !== 'undefined' && frm.doc.trim_composition !== ''){
            fabric_description_string += frm.doc.trim_composition + ' ';
        }
        if(typeof frm.doc.trim_color !== 'undefined' && frm.doc.trim_color !== 'undefined' && frm.doc.trim_color !== ''){
            fabric_description_string += frm.doc.trim_color + ' ';
        }

        let item_reference_string = get_item_reference_string(frm);
        if(typeof item_reference_string !== 'undefined' && item_reference_string !== 'undefined' && item_reference_string !== ''){
            fabric_description_string += item_reference_string + ' ';
        }

        if(fabric_description_string !== '')
            frm.doc.trim_description = fabric_description_string;

        frm.set_df_property('trim_description','read_only', 1);
        frm.refresh_field('trim_description');

        if(frm.doc.trim_description !== ''){
            frm.doc.item_name = frm.doc.trim_description;
            frm.set_df_property('item_name','read_only', 1);
            frm.refresh_field('item_name');
        }
    }
    else{
        fabric_description_string += frm.doc.item_group+' ';
        if(typeof frm.doc.fabric_structure !== 'undefined' && frm.doc.fabric_structure !== 'undefined' && frm.doc.fabric_structure !== ''){
            fabric_description_string += frm.doc.fabric_structure + ' ';
        }
        if(frm.doc.fabric_structure == 'Knit' && typeof frm.doc.fabric_segment !== 'undefined' && frm.doc.fabric_segment !== 'undefined' && frm.doc.fabric_segment !== ''){
            fabric_description_string += frm.doc.fabric_segment + ' ';
        }
        
        if(frm.doc.fabric_structure == 'Woven'){
            if(typeof frm.doc.composition !== 'undefined' && frm.doc.composition !== 'undefined' && frm.doc.composition !== ''){
                fabric_description_string += frm.doc.composition + ' ';
            }
            if(typeof frm.doc.weave_structure !== 'undefined' && frm.doc.weave_structure !== 'undefined' && frm.doc.weave_structure !== ''){
                fabric_description_string += frm.doc.weave_structure + ' ';
            }

            let warp_available = 0;
            if(typeof frm.doc.warp_count !== 'undefined' && frm.doc.warp_count !== 'undefined' && frm.doc.warp_count !== ''){
                fabric_description_string += frm.doc.warp_count+"'s";
                warp_available = 1;
            }
            if(typeof frm.doc.weft_count !== 'undefined' && frm.doc.weft_count !== 'undefined' && frm.doc.weft_count !== ''){
                if(warp_available){
                    fabric_description_string += 'X';
                }
                fabric_description_string += frm.doc.weft_count+"'s";
            }
            if(warp_available > 0)
                fabric_description_string += ' ';

            let rot_available = 0;
            if(typeof frm.doc.read_on_table !== 'undefined' && frm.doc.read_on_table !== 'undefined' && frm.doc.read_on_table !== ''){
                fabric_description_string += frm.doc.read_on_table;
                rot_available = 1;
            }
            if(typeof frm.doc.pick_on_table !== 'undefined' && frm.doc.pick_on_table !== 'undefined' && frm.doc.pick_on_table !== ''){
                if(rot_available){
                    fabric_description_string += 'X';
                }
                fabric_description_string += frm.doc.pick_on_table;
            }
            if(rot_available > 0)
                fabric_description_string += ' ';
            
            if(typeof frm.doc.gsm !== 'undefined' && frm.doc.gsm !== 'undefined' && frm.doc.gsm > 0){
                fabric_description_string += frm.doc.gsm + ' gsm ';
            }

            if(typeof frm.doc.finished_width !== 'undefined' && frm.doc.finished_width !== 'undefined' && frm.doc.finished_width !== ''){
                fabric_description_string += frm.doc.finished_width + '" ';
            }
        }
        else{
            if(typeof frm.doc.type_of_fabric !== 'undefined' && frm.doc.type_of_fabric !== 'undefined' && frm.doc.type_of_fabric !== ''){
                fabric_description_string += frm.doc.type_of_fabric + ' ';
            }
            if(typeof frm.doc.construction !== 'undefined' && frm.doc.construction !== 'undefined' && frm.doc.construction !== ''){
                fabric_description_string += frm.doc.construction + ' ';
            }
            if(typeof frm.doc.composition !== 'undefined' && frm.doc.composition !== 'undefined' && frm.doc.composition !== ''){
                fabric_description_string += frm.doc.composition + ' ';
            }
            if(typeof frm.doc.count_and_gauge !== 'undefined' && frm.doc.count_and_gauge !== 'undefined' && frm.doc.count_and_gauge !== ''){
                fabric_description_string += frm.doc.count_and_gauge + "'s ";
            }
            if(typeof frm.doc.gauge !== 'undefined' && frm.doc.gauge !== 'undefined' && frm.doc.gauge !== ''){
                fabric_description_string += frm.doc.gauge + 'G ';
            }
            if(typeof frm.doc.gsm !== 'undefined' && frm.doc.gsm !== 'undefined' && frm.doc.gsm > 0){
                fabric_description_string += frm.doc.gsm + ' gsm ';
            }
            if(typeof frm.doc.finished_width !== 'undefined' && frm.doc.finished_width !== 'undefined' && frm.doc.finished_width !== ''){
                fabric_description_string += frm.doc.finished_width + '" ';
            }
            if(typeof frm.doc.width_type !== 'undefined' && frm.doc.width_type !== 'undefined' && frm.doc.width_type !== ''){
                fabric_description_string += frm.doc.width_type + ' ';
            }
            if(typeof frm.doc.knitting_dia !== 'undefined' && frm.doc.knitting_dia !== 'undefined' && frm.doc.knitting_dia !== ''){
                // fabric_description_string += frm.doc.knitting_dia + ' '; 
            }

        }

        if(typeof frm.doc.select_fabric_color !== 'undefined' && frm.doc.select_fabric_color !== 'undefined' && frm.doc.select_fabric_color !== ''){
            fabric_description_string += frm.doc.select_fabric_color + ' ';
        }

        if(typeof frm.doc.design !== 'undefined' && frm.doc.design !== 'undefined' && frm.doc.design !== ''){
            // fabric_description_string += frm.doc.design + ' ';
        }

        if(typeof frm.doc.special_process !== 'undefined' && frm.doc.special_process !== 'undefined' && frm.doc.special_process !== ''){
            fabric_description_string += frm.doc.special_process + ' ';
        }
        
        let item_reference_string = get_item_reference_string(frm);
        if(typeof item_reference_string !== 'undefined' && item_reference_string !== 'undefined' && item_reference_string !== ''){
            fabric_description_string += item_reference_string + ' ';
        }

        if(fabric_description_string.indexOf('null') !== -1){
            fabric_description_string = fabric_description_string.replace('null','');
        }            
        
        if(fabric_description_string.indexOf('undefined') !== -1){
            fabric_description_string.replace('undefined','');
        }

        if(fabric_description_string !== '')
            frm.doc.fabric_description = fabric_description_string;

        

        frm.set_df_property('fabric_description','read_only', 1);
        frm.refresh_field('fabric_description');

        if(frm.doc.fabric_description !== ''){
            frm.doc.item_name = frm.doc.fabric_description;
            frm.set_df_property('item_name','read_only', 1);
            frm.refresh_field('item_name');
        }
    }
}

function fill_composition_field(frm){
    let composition_string = '';
    frm.doc.fabric_composition.forEach(function(cst){
        // console.log(typeof cst.fabric_content);
        if(typeof cst.fabric_percentage !== 'undefined' && cst.fabric_percentage !== '')
            composition_string +=  cst.fabric_percentage + ' %  ';
        if(typeof cst.fabric_content !== 'undefined' && cst.fabric_content !== '')
            composition_string += cst.fabric_content + ' '        
	});
    let column_array = {
        'Fabric':'composition',
        'Trims':'trim_composition'
    }
    
    if(frm.doc.item_group_category == ''){
        frappe.throw('Please select the Item Group.');
        return;
    }
    
    if(composition_string !== ''){
        frm.doc[column_array[frm.doc.item_group_category]] = composition_string;
        set_fabric_description(frm);
    }
    frm.refresh_field(column_array[frm.doc.item_group_category]);
}

frappe.ui.form.on('Item', 'item_group',
    function(frm, cdt, cdn){   
           
        frappe.db.get_doc('Item Group',frm.doc.item_group).then(doc => {
            frm.set_value('item_group_category',doc.group_category)
        });	
        show_fabric_fields(frm)
        set_item_sub_group(frm)
            
    }

);


function get_fabric_segment(frm){
    let hidden = 1;
    if(frm.doc.fabric_structure == 'Knit'){
        hidden = 0;
    }
    frm.set_df_property("fabric_segment", "hidden", hidden);
}

function setupFabricFieldsBySegment(frm){
    let segmentFields = {
        "Woven":["weave_structure","composition","warp_count","weft_count","read_on_table","pick_on_table","finished_width","cuttable_width","gsm","select_fabric_color","design","special_process","buyer_short_code","fabric_direction","fabric_description"],
        "Knit":["fabric_segment","type_of_fabric","width_type","construction","count_and_gauge","gauge","finished_width","gsm","knitting_dia","select_fabric_color","composition","design","special_process","buyer_short_code","fabric_direction","fabric_description"],
        // "Non-Woven":[]
    }
    
    Object.keys(segmentFields).forEach(function(value, index){
        let noHidden = segmentFields[frm.doc.fabric_structure];
        segmentFields[value].forEach(function(column,colindex){ 
            let hideProperty = 1; // set the field hide
            if(noHidden.indexOf(column) !== -1)
                hideProperty = 0;
            
            frm.set_df_property(column,'hidden',hideProperty);
        });    
});
}

function show_fabric_fields(frm){
    if(frm.doc.item_group){
        frappe.db.get_value('Item Group', frm.doc.item_group, 'group_category').then(
            doc=>{
                let hiddenProperty = 1;
                if(doc.message.group_category == 'Fabric'){
                    setupFabricFieldsBySegment(frm);
                    hiddenProperty = 0;
                    if(frm.doc.fabric_process){
                        set_fabric_process_details(frm)
                    }

                    Object.keys(frm.datatable).forEach(function(val,index){
                        frm.datatable[val].refresh();
                    });
                }

                frm.set_df_property("fabric_details", "hidden", hiddenProperty);
                frm.set_df_property("fabric_process_route", "hidden", hiddenProperty);
                // frm.set_df_property("yarn_fabric_details", "hidden", hiddenProperty);
                let hiddenTrim = 1;
                if(doc.message.group_category == 'Trims'){
                    hiddenProperty = 0;
                    hiddenTrim = 0;
                }
                frm.set_df_property("trim_details", "hidden", hiddenTrim);
                frm.set_df_property("fabric_composition_sec", "hidden", hiddenProperty);
                frm.set_df_property("item_reference_details", "hidden", hiddenProperty);
               
            }
        )
    }
}

frappe.ui.form.on('Item', 'fabric_process',
    function(frm, cdt, cdn){
        set_fabric_process_details(frm)
    }
)  

function set_fabric_process_details(frm){
    if(frm.doc.fabric_process){
        frappe.call({
            method: "style_master_costing.style_master_costing.doctype.process.process.get_routes_list",
                  args: {
                      'process_name':frm.doc.fabric_process
                  },
                  callback: function(r) {
            if(r.message){
                frm.set_df_property("process", "hidden", 0);
                // frm.get_field("process").grid.grid_buttons.css({'visibility':'hidden'});
                
                frm.clear_table('process')
                frm.fields_dict['process'].grid.wrapper.find('.btn-open-row').hide();
                frm.set_df_property('process', 'read_only', 1);
                let routes = r.message
                routes.forEach(function (route) {
                    frm.add_child('process', {
                        process_name:route.process_name,
                        process_description:route.process_description,
                      })
                  });
               
                frm.refresh_field('process');
            }}
        })
    }
}
// Set sub groups of Item group
function set_item_sub_group(frm){

    frappe.call({
        method:"style_master_costing.docevents.item.get_item_sub_group",
        args: {
            "item_group": frm.doc.item_group
        },
        callback: function(r){
            var grp_list = [];
            r.message.forEach(function(grp){
                grp_list.push(grp.name)
            })
            frm.set_df_property('item_sub_group', 'options', [""].concat(grp_list));
            frm.refresh_field('item_sub_group');
        }
    })
}

function set_item_group_category(frm){
    if(typeof frm.doc.item_sub_group !== 'undefined' && frm.doc.item_sub_group !== 'undefined'){
        frappe.call({
            method:"style_master_costing.docevents.item.get_item_sub_group",
            args: {
                "item_group":frm.doc.item_sub_group
            },
            callback: function(r){
                var category_list = [];
                r.message.forEach(function(category){
                    category_list.push(category.name)
                });
                let hiddenProperty = 1;
                if(category_list.length > 0){
                    hiddenProperty = 0;
                    frm.set_df_property('item_category', 'options', [""].concat(category_list));
                }
                frm.set_df_property("item_category", "hidden", hiddenProperty);

                frm.refresh_field('item_category');
            }
        });
    }
}