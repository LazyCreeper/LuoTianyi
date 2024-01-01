try {
  if (bind_user == 'True'){
    var bindAccount = new BindAccount();
    bindAccount.installBindUser();
  }
} catch (error) {}

$("select[name='network-io'],select[name='disk-io']").change(function () {
  var key = $(this).val(), type = $(this).attr('name')
  if (type == 'network-io') {
    if (key == 'all') key = '';
    bt.set_cookie('network_io_key', key);
  } else {
    bt.set_cookie('disk_io_key', key);
  }
});
$('.tabs-nav span').click(function () {
  var indexs = $(this).index();
  $(this).addClass('active').siblings().removeClass('active')
  $('.tabs-content .tabs-item:eq(' + indexs + ')').addClass('tabs-active').siblings().removeClass('tabs-active')
  $('.tabs-down select:eq(' + indexs + ')').removeClass('hide').siblings().addClass('hide')
  switch (indexs) {
    case 0:
      index.net.table.resize();
      break;
    case 1:
      index.iostat.table.resize();
      break;
  }
})


var table_confirm_show = false;
var interval_stop = false;
var index = {
  // 顾问服务弹窗
  consultancy_services: function (show) {
    var consultancy_cookies = bt.get_cookie('consultancy_cookies');
    if (consultancy_cookies) return false;
    if (show !== 0) return false;
    layer.open({
      type: 1,
      title: '免费顾问服务',
      closeBtn: false,
      area: ['600px', '470px'],
      btn: ['接受顾问服务', '放弃顾问服务'],
      content: '<div style="padding: 30px 35px;">\
                <div style="text-align: center;margin-bottom: 20px;font-size: 20px;height: 40px;line-height: 40px;">\
                <span style="vertical-align: middle;margin-left: 10px;font-size:21px;">感恩您使用宝塔，我们为您提供专属客服服务</span></div>\
                <div style="font-size: 14px;line-height: 27px;padding: 20px;border: 1px solid #ececec;border-radius: 5px;background: #fcfcfc;color: #555;text-indent:2em;">\
                    <div style="text-indent: 2em;margin-bottom: 10px;">我们提供给您<span style="font-weight: bold;">【免费的顾问服务】</span>，确保您在使用宝塔面板过程中遇到紧急或者棘手的问题能第一时间找到专人协助您处理，我们期待与您沟通。</div>\
                    <div style="text-indent: 2em;margin-bottom: 10px;">如果您点<span style="font-weight: bold;">【接受顾问服务】</span>，您无需再做什么，我们会有专人致电联系您并加您为好友，让您可以在有疑问的时候能第一时间联系到专员。</div>\
                    <div style="text-indent: 2em;margin-bottom: 10px;">同时您也可以<span style="font-weight: bold;">【放弃顾问服务】</span>，在遇到问题的时候可以在我们官网论坛发言，我们也有论坛值守人员协助您处理。</div></div>\
                </div>',
      yes: function (indexs, layero) {
        bt.send('set_user_adviser', 'auth/set_user_adviser ', { status: 1 }, function (res) {
          bt.set_cookie('consultancy_cookies', '1');
          layer.close(indexs);
          bt.msg(res)
        })
      },
      btn2: function (indexs, layero) {
        layer.confirm('是否放弃免费顾问服务，放弃后在遇到问题的时候可以在我们官网论坛发言，我们也有论坛值守人员协助您处理。', {
          title: '提示',
          area: '400px',
          btn: ['确认', '取消'],
          icon: 0,
          closeBtn: 2,
          yes: function () {
            bt.send('set_user_adviser', 'auth/set_user_adviser ', { status: 0 }, function (res) {
              bt.set_cookie('consultancy_cookies', '1');
              layer.close(indexs);
              bt.msg(res)
            })
          }
        })
        return false
      }
    })
  },
  warning_list: [],
  warning_num: null,
  series_option: {},// 配置项
  chart_json: {}, // 所有图表echarts对象
  chart_view: {}, // 磁盘echarts对象
  disk_view: [], // 释放内存标记
  chart_result: null,
  release: false,
  load_config: [{
    title: '运行堵塞',
    val: 90,
    color: '#dd2f00'
  }, {
    title: '运行缓慢',
    val: 80,
    color: '#ff9900'
  }, {
    title: '运行正常',
    val: 70,
    color: '#ff87c8'
  }, {
    title: '运行流畅',
    val: 30,
    color: '#ff87c8'
  }],
  cache_system_push: {},// 缓存告警信息
  all_status: {// 单个信息
    load: {},
    cpu: {},
    mem: {},
    disk: {}
  },
  alarm_type_list: [{title: '【负载状态】告警',value: 'load'},{title: '【CPU使用率】告警',value: 'cpu'},{title: '【内存使用率】告警',value:'mem'}],// 告警任务类型
  msg_config: {},// 告警通知配置
  release: false,
  interval: {
    limit: 10,
    count: 0,
    task_id: 0,
    start: function () {
      var _this = this;
      _this.count = 0;
      // _this.task_id = setInterval(function () {
      //   if (_this.count >= _this.limit) {
      //     _this.reload();
      //     return;
      //   }
      //   _this.count++;
      //   if (!interval_stop) index.reander_system_info();
      // }, 3000)
      if (!interval_stop) index.reander_system_info();
    },
    reload: function () {
      var _this = this;
      if (_this) clearInterval(_this.task_id);
      _this.start();
    }
  },
  net: {
    table: null,
    data: {
      uData: [],
      dData: [],
      aData: []
    },
    init: function () {
      //流量图表
      index.net.table = echarts.init(document.getElementById('NetImg'));
      var obj = {};
      obj.dataZoom = [];
      obj.unit = lan.index.unit + ':KB/s';
      obj.tData = index.net.data.aData;
      obj.formatter = function (config) {
        var _config = config, _tips = '';
        for (var i = 0; i < config.length; i++) {
          if (typeof config[i].data == "undefined") return false
          _tips += '<span style="display: inline-block;width: 10px;height: 10px;margin-rigth:10px;border-radius: 50%;background: ' + config[i].color + ';"></span>  ' + config[i].seriesName + '：' + (parseFloat(config[i].data)).toFixed(2) + ' KB/s' + (config.length - 1 !== i ? '<br />' : '')
        }
        return "时间：" + _config[0].axisValue + "<br />" + _tips;
      }
      obj.list = [];
      obj.list.push({ name: lan.index.net_up, data: index.net.data.uData, circle: 'circle', itemStyle: { normal: { color: '#f7b851' } }, areaStyle: { normal: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(255, 140, 0,1)' }, { offset: 1, color: 'rgba(255, 140, 0,.4' }], false) } }, lineStyle: { normal: { width: 1, color: '#f7b851' } } });
      obj.list.push({ name: lan.index.net_down, data: index.net.data.dData, circle: 'circle', itemStyle: { normal: { color: '#52a9ff' } }, areaStyle: { normal: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(30, 144, 255,1)' }, { offset: 1, color: 'rgba(30, 144, 255,.4)' }], false) } }, lineStyle: { normal: { width: 1, color: '#52a9ff' } } });
      option = bt.control.format_option(obj)

      index.net.table.setOption(option);
      window.addEventListener("resize", function () {
        index.net.table.resize();
      });
    },
    add: function (up, down) {
      var _net = this;
      var limit = 8;
      var d = new Date()
      if (_net.data.uData.length >= limit) _net.data.uData.splice(0, 1);
      if (_net.data.dData.length >= limit) _net.data.dData.splice(0, 1);
      if (_net.data.aData.length >= limit) _net.data.aData.splice(0, 1);
      _net.data.uData.push(up);
      _net.data.dData.push(down);
      _net.data.aData.push(d.getHours() + ':' + d.getMinutes() + ':' + d.getSeconds());
    }
  },
  iostat: {
    table: null,
    data: {
      uData: [],
      dData: [],
      aData: [],
      tipsData: []
    },
    init: function () {
      //流量图表
      index.iostat.table = echarts.init(document.getElementById('IoStat'));
      var obj = {};
      obj.dataZoom = [];
      obj.unit = lan.index.unit + ':MB/s';
      obj.tData = index.iostat.data.aData;
      obj.formatter = function (config) {
        var _config = config, _tips = "时间：" + _config[0].axisValue + "<br />", options = {
          read_bytes: '读取字节数',
          read_count: '读取次数 ',
          read_merged_count: '合并读取次数',
          read_time: '读取延迟',
          write_bytes: '写入字节数',
          write_count: '写入次数',
          write_merged_count: '合并写入次数',
          write_time: '写入延迟',
        }, data = index.iostat.data.tipsData[config[0].dataIndex], list = ['read_count', 'write_count', 'read_merged_count', 'write_merged_count', 'read_time', 'write_time',]
        for (var i = 0; i < config.length; i++) {
          if (typeof config[i].data == "undefined") return false
          _tips += '<span style="display: inline-block;width: 10px;height: 10px;border-radius: 50%;background: ' + config[i].color + ';"></span>&nbsp;&nbsp;<span>' + config[i].seriesName + '：' + (parseFloat(config[i].data)).toFixed(2) + ' MB/s' + '</span><br />'
        }
        $.each(list, function (index, item) {
          _tips += '<span style="display: inline-block;width: 10px;height: 10px;"></span>&nbsp;&nbsp;<span style="' + (item.indexOf('time') > -1 ? ('color:' + ((data[item] > 100 && data[item] < 1000) ? '#ff9900' : (data[item] >= 1000 ? 'red' : '#20a53a'))) : '') + '">' + options[item] + '：' + data[item] + (item.indexOf('time') > -1 ? ' ms' : ' 次/秒') + '</span><br />'
        })
        return _tips;
      }
      obj.list = [];
      obj.list.push({ name: '读取字节数', data: index.iostat.data.uData, circle: 'circle', itemStyle: { normal: { color: '#FF4683' } }, areaStyle: { normal: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(255,70,131,1)' }, { offset: 1, color: 'rgba(255,70,131,.4' }], false) } }, lineStyle: { normal: { width: 1, color: '#FF4683' } } });
      obj.list.push({ name: '写入字节数', data: index.iostat.data.dData, circle: 'circle', itemStyle: { normal: { color: '#6CC0CF' } }, areaStyle: { normal: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(108,192,207,1)' }, { offset: 1, color: 'rgba(108,192,207,.4)' }], false) } }, lineStyle: { normal: { width: 1, color: '#6CC0CF' } } });
      option = bt.control.format_option(obj)
      index.iostat.table.setOption(option);
      window.addEventListener("resize", function () {
        index.iostat.table.resize();
      });
    },
    add: function (read, write, data) {
      var _disk = this;
      var limit = 8;
      var d = new Date()
      if (_disk.data.uData.length >= limit) _disk.data.uData.splice(0, 1);
      if (_disk.data.dData.length >= limit) _disk.data.dData.splice(0, 1);
      if (_disk.data.aData.length >= limit) _disk.data.aData.splice(0, 1);
      if (_disk.data.tipsData.length >= limit) _disk.data.tipsData.splice(0, 1);
      _disk.data.uData.push(read);
      _disk.data.dData.push(write);
      _disk.data.tipsData.push(data);
      _disk.data.aData.push(d.getHours() + ':' + d.getMinutes() + ':' + d.getSeconds());
    }
  },
  /**
   * 表格生成器
   * @param {*} el 表格挂载节点
   * @param {*} data 表格挂载数据
   * @param config 表格配置
   */
  table_generation: function (el, data, config) {
    _this = this
    // 清理表格
    $(el).empty();

    bt_tools.table({
      data: data,
      el: el,
      height: '350px',
      minWidth: '290px',
      column: [
        {
          fid: 'proc_name',
          title: '进程名',
          width: '100px',
          template: function (row, index) {
            return '<div title="备注：' + row.explain + '\n启动路径：' + row.exe_path + '\n运行目录：' + row.cwd_path + '\n线程数量：' + row.num_threads + '" style="overflow: hidden;text-overflow: ellipsis;">' + row.proc_name + '</div>';
          },
        },
        {
          fid: config.fid[0],
          width: '80px',
          title: config.title[0],
        },
        // {
        //   fid: config.fid[1],
        //   width: '100px',
        //   title: config.title[1],
        // },
        {
          title: '操作',
          width: '40px',
          type: 'group',
          align: 'right',
          group: [
            {
              title: config.fid[0] == 'cpu_percent' ? '结束' : '释放',
              event: function (row, index, ev, key, that) {
                table_confirm_show = true;
                var load;
                if (row.important !== 1) {
                  bt.compute_confirm({title:'结束【' + row.proc_name + '】进程',msg:'结束【' + row.proc_name + '】进程会导致'+row.explain.split('的进程')[0]+'无法正常运行，是否结束?'}, function () {
                    load = bt.load();
                    bt_tools.send(
                      {
                        url: '/monitor/process_management/kill_process_all',
                        data: {
                          pid: row.pid.toString(),
                        },
                      },
                      function (res) {
                        load.close();
                        if (res.status) {
                          layer.msg(res.msg, {icon: 1});
                          table_confirm_show = false;
                        } else {
                          layer.msg(res.msg, {icon: 2});
                          table_confirm_show = false;
                        }
                      }
                    );
                    load.close();
                  })
                  table_confirm_show = false;
                } else {
                  var s = config.fid[0] == 'cpu_percent' ? '结束' : '释放'
                  layer.msg('该进程为系统进程，禁止' + s, {icon: 2});
                  table_confirm_show = false;
                }
              },
            },
          ],
        },
      ],
    });
    $('.divtable').css('border', '0px');
    $('td').css({'word-break':'break-all','text-overflow': 'ellipsis'});
    $('table').css({'table-layout': 'fixed','white-space': 'nowrap'})
  },
  get_init: function () {
    var _this = this;
    var layer_id = 0;
    var layer_table_time = 0;
    var postion_time = 0;
    var time = 0
    var mouseY, mouseX;
    /**
     * 创建表格
     * @param el 表格挂载节点
     * @param type 渲染表格类型
     * @param config 表格配置
     */
    var create_data_table = function (el, type, config) {
      bt_tools.send({url: '/monitor/process_management/specific_resource_load_type'}, function (res) {
        if (res.hasOwnProperty('status') && res['status'] === false) {
					var item_CPU = {
						"proc_name": "BT-****",
						"pid": '284**',
						"cpu_percent": "2.**%",
						"memory_usage": "*.**%",
						"proc_survive": "2*\u5206\u949f"
					}
					var item_CPU_x = {
						"proc_name": "**-****",
						"pid": '*****',
						"cpu_percent": "*.**%",
						"memory_usage": "*.**%",
						"proc_survive": "**\u5206\u949f"
					}
          res.CPU_high_occupancy_software_list = [item_CPU, item_CPU_x, item_CPU_x, item_CPU_x, item_CPU_x]
          res.memory_high_occupancy_software_list = [item_CPU, item_CPU_x, item_CPU_x, item_CPU_x, item_CPU_x]
					//显示开通企业版
          $('.un-profession').css('display', 'flex')
        } else {
          // if(!$('#other .disk-item-list').hasClass('active')){
          //   $('#other .disk-item-list').addClass('active');
          //   $('#other .disk-item-list').find('span').text('收起');
          //   $('#other .disk-item-list').find('img').css('transform', 'rotate(180deg)');
          // }
          $('.load_tips .disk-item-footer').css('display', 'flex')
				}
				_this.table_generation(el, res[type] || {}, config);
        if (res.info && res.info.load_avg) {
          $('#load_one').text(res.info.load_avg['1'] + '  /  ' + res.info.load_avg['5'] + '  /  ' + res.info.load_avg['15'])
				}
        if (res.info) {
					$('#load_cpu_times_num').text(res.info.active_processes+ '  /  ' + res.info.total_processes)
				}
        _this.isCorporat = res.status === false;
      }, {verify: false});
    }
    /**
     * 弹窗
     * @param config 格式
     * {
     * table:{
     *  type:'',
     *  table_title:[],
     *  table_fid:[],
     * },
     * html:{
     *   base_html:'',
     *   disk_title:'',
     *   table_id:'',
     *   position:'',
     *   newClass:'',
     * }
     * }
     */
    var float_box = function (config) {
      if (postion_time) {
        clearInterval(postion_time);
      }
      $('body').find('.layui-layer').remove()
      var is_other_active = bt.get_storage('LoadTips' + config.html.newClass + '_other_info'),
        is_top_active = bt.get_storage('LoadTips' + config.html.newClass + '_top5_info')
      var other_table_html = '', num = 0,
          title = {
            user: '用户级别的 CPU 时间百分比',
            system: '系统级别的 CPU 时间百分比',
            idle: '空闲状态的 CPU 时间百分比',
            iowait: '等待 I/O 操作完成的 CPU 时间百分比',
            irq: '处理硬件中断的 CPU 时间百分比',
            softirq: '处理软件中断的 CPU 时间百分比',
            guest: '运行虚拟机时使用的 CPU 时间百分比',
            steal: '当前 CPU 被其他虚拟机偷取的CPU时间百分比',
            guest_nice: '运行带有 “nice” 优先级的虚拟机时使用的CPU时间百分比',
            nice: '运行带有 “nice” 优先级的进程时使用的 CPU 时间百分比'
          }
      var is_other = config.html.hasOwnProperty('cpu_times') && config.html.cpu_times.length
      if (is_other) {//cpu使用率 其他信息
        for (var i = 0; i < config.html.cpu_times.length; i++) {
          var is_next = config.html.cpu_times.hasOwnProperty(i + 1)
          other_table_html += '<div class="disk-body-list">\
            <span>核心 ' + (i + 1) + (is_next ? ' / ' + (i + 2) : '') + ' 占用：</span>\
            <span id="cpu_' + (i + 1) + '_num">' + config.html.cpu_times[i] + '%' + (is_next ? ' / ' + config.html.cpu_times[i + 1] + '%' : '') + '</span>\
          </div>'
          i++
        }
      } else {//负载状态 其他信息
        for (var key in config.html.cpu_times) {
          var val = config.html.cpu_times[key];
          if (key !== '总进程数' && key !== '活动进程数') {
            if (num % 2 === 0) {
              other_table_html += '<tr>'
            }
            other_table_html += '<td title="' + title[key] + '"><span>' + key + '</span></td><td title="' + title[key] + '">' + val + '</td>'
            if (num % 2 === 1) {
              other_table_html += '</tr>'
            }
            num++
          }
        }
      }
      layer_id = layer.open({
        type: 1,
        shade: 0,
        area: '360px',
        title: false,
        skin: 'load_tips ' + config.html.newClass,
        fixed: false,
        closeBtn: false,
        id: 'LoadTips' + config.html.newClass,
        offset: [($(config.html.position).offset().top + 140 - $(window).scrollTop()) + 'px', $(config.html.position).offset().left + 'px'],
        content:
          '<div class=" load_tips disk_cont">\
            <div id="slot"></div>\
            <div class="disk-item-list active base_html" id="base_info">\
              <div class="disk-item-header">\
                  <div class="disk-header-title">基础信息</div>\
              </div>\
              <div class="disk-item-body" id="base_info_html">' + config.html.base_html + '</div>\
              </div>' +
          (config.html.cpu_times ? '<div class="disk-item-list other_html ' + (is_other_active ? 'active' : '') + '" id="other_info">\
              <div class="disk-item-header">\
                <div class="disk-header-title">'+ config.html.title +'</div>\
                <div class="disk-header-fold flex"><span class="mr8">'+ (is_other_active ? '折叠' : '展开') +'</span><img src="/static/img/arrow-down.svg" '+ (is_other_active ? 'style="transform: rotate(180deg);"' : '') +' class="icon-index-arrow"></div>\
              </div>\
              <div class="disk-item-body ' + (is_other ? 'cpu-core-body' : '') + '" id="other_info_html" ' + (is_other ? '' : 'style="padding: 16px 16px 0;') + '">' + (is_other ? other_table_html : '<table class="table" style="border:#ddd 1px solid;"><tbody>' + other_table_html + '</tbody></table>') + '</div></div>' : '') +
              '<div id = "other">\
                <div class="disk-item-list ' + (is_top_active ? 'active' : '') + '" id="top5_info">\
                    <div class="disk-item-header" mark="cpu">\
                      <div class="disk-header-title">' + config.html.disk_title + '</div>\
                  <div class="disk-header-fold flex"><span class="mr8">' + (is_top_active ? '折叠' : '展开') + '</span><img src="/static/img/arrow-down.svg" ' + (is_top_active ? 'style="transform: rotate(180deg);"' : '') + ' class="icon-index-arrow"></div>\
                </div>\
                <div class="disk-item-body disk-item-body-nottom" style="position:relative">\
                  <div class="disk-body-list no-bg">\
									<div class="load-list index_status_table" id="' + config.html.table_id + '"></div>\
                  \
									<div class="un-profession" style="display:none;bottom: 24px;">\
									</div>\
                  </div>\
                  <div class="disk-item-footer '+ (config.html.isShow ? 'hide' : '') +'" style="text-align: center;">\
                    <a id="task_manager_btn" style="margin:auto" title="立即购买" class="btlink"">立即购买</a>\
                  </div>\
                </div>\
							</div>'+
              '</div>\
            </div>',
        success: function (layero, index) {
          // <div class="corporat-tip">\
					// 						<span  class="un-corporat-tip"></span>\
					// 						<span>此功能为企业版专享 </span>\
					// 						<button type="button" onclick="bt.soft.product_pay_view({ totalNum: 141, limit: \'ltd\', closePro: true })"></span>立即升级</button>\
          // 	    </div>\

          $(layero).find('.bt_switch input').each(function (index, item) {
            $(this).change(function () {
              var status = $(this).prop('checked'),
                name = $(this).parent().parent().find('.set_alarm_status').data('type'), id = '';
              var alarm_data = _this.get_alarm_data(name)
              id = alarm_data['id'] ? alarm_data['id'] : ''
              //id 不存在则添加告警 id 存在则开启/关闭告警
              if (!status) { //存在告警关闭告警
                bt.simple_confirm({
                  title: '关闭告警',
                  msg: '关闭告警后，将不再接收到该项的告警信息，是否继续操作？'
                }, function () {
                  _this.set_push_status(id, 0)
                }, function () {
                  $('#' + name + 'Tips').prop('checked', !$('#' + name + 'Tips').is(':checked'))
                })
              } else { //不存在告警添加告警 或者 存在则开启告警
                if (id) {
                  bt.simple_confirm({
                    title: '开启告警',
                    msg: '开启告警后，达到触发条件会收到该项的告警信息，是否继续操作？'
                  }, function () {
                    _this.set_push_status(id, 1)
                  }, function () {
                    $('#' + name + 'Tips').prop('checked', !$('#' + name + 'Tips').is(':checked'))
                  })
                } else {
                  var data = {
                    type: name,
                  }
                  _this.open_alarm(data, true)
                }
              }
            })
            $(this).parent().parent().find('.set_alarm_status').click(function () {
              var name = $(this).data('type'), id = '';
              var alarm_data = _this.get_alarm_data(name)
              id = alarm_data['id'] ? alarm_data['id'] : ''
              if (id) {
                _this.open_alarm(alarm_data)
              } else {
                var data = {
                  type: name,
                }
                _this.open_alarm(data)
              }
            })
          })

          //预渲染一个空表格占位
          _this.table_generation('#' + config.html.table_id, '', {
            fid: config.table.table_fid,
            title: config.table.table_title
          });
          //立即获取数据渲染真表格
          create_data_table('#' + config.html.table_id, config.table.type, {
            fid: config.table.table_fid,
            title: config.table.table_title,
          });
          //定时获取数据渲染真表格刷新新基础信息
          if (time) {
            clearInterval(time);
          }

          function layer_table_time_fun() {
            time = setTimeout(function () {
              create_data_table('#' + config.html.table_id, config.table.type, {
                fid: config.table.table_fid,
                title: config.table.table_title,
              });
              layer_table_time_fun()
            }, 6000);
          }

          layer_table_time_fun()
          $(window).resize(function () {
            var class_name = '.' + config.html.newClass
            if ($(class_name).length) {
              $(class_name).css({
                top: $(config.html.position).offset().top + 140 - $(window).scrollTop() + 'px',
                left: $(config.html.position).offset().left,
              });
            }
          });
          //判断是否有插入内容，将插入内容替换掉基础信息
          if (!config.html.base_html) {
            $('.base_html').remove();
            config.html.slot ? $('#slot').html(config.html.slot) : '';
          } else {
            if (config.html.slot) {
              $('#slot').html(config.html.slot)
            }
          }
          //获取鼠标isCisCoporary坐标
          $(document).mousemove(function (e) {
            mouseY = e.pageY;
            mouseX = e.pageX;
          });
          //内存释放
          $('#mem_scanning_btn').on('click', function () {
            var that = $(this);
            var data = _this.chart_result.mem;
            bt.show_confirm('真的要释放内存吗？', '<font style="color:red;">若您的站点处于有大量访问的状态，释放内存可能带来无法预测的后果，您确定现在就释放内存吗？</font>', function () {
              _this.release = true;
              var option = JSON.parse(JSON.stringify(_this.series_option));
              // 释放中...
              var count = '';
              var setInter = setInterval(function () {
                if (count == '...') {
                  count = '.';
                } else {
                  count += '.';
                }
                option.series[0].detail.formatter = '释放中' + count;
                option.series[0].detail.fontSize = 15;
                option.series[0].data[0].value = 0;
                _this.chart_view.mem.setOption(option, true);
                that.next().hide();
              }, 400);
              // 释放接口请求
              bt.system.re_memory(function (res) {
                that.next().show();
                clearInterval(setInter);
                var memory = data.memRealUsed - res.memRealUsed;
                option.series[0].detail = $.extend(option.series[0].detail, {
                  formatter: '已释放\n' + bt.format_size(memory > 0 ? memory : 0) + '',
                  lineHeight: 18,
                  padding: [5, 0],
                });
                _this.chart_view.mem.setOption(option, true);
                setTimeout(function () {
                  _this.release = false;
                  _this.chart_result.mem = res;
                  _this.chart_active('mem');
                }, 2000);
              });
            });
          });
					// 查看进程，下载任务管理器
					$('#task_manager_btn').on('click', function () {
            var ltd_end = bt.get_cookie('ltd_end') > 0;

            bt.soft.get_soft_find('task_manager', function (dataRes) {
							// 打开其他弹窗前把当前弹窗关闭，防止弹窗重叠
              $('.' + config.html.newClass).remove();
              if (ltd_end) {
                if (dataRes.setup && dataRes.endtime > 0) {
                  bt.soft.set_lib_config(dataRes.name, dataRes.title, dataRes.version)
                } else {
                  bt.soft.install('task_manager')
                }
              } else {
                product_recommend.pay_product_sign('ltd', 141, 'ltd')
              }
							// if(dataRes.setup && dataRes.endtime > 0) {
							// 	bt.soft.set_lib_config(dataRes.name,dataRes.title,dataRes.version)
							// }else{
							// 	var is_buy = dataRes.endtime < 0 && dataRes.pid > 0
              //   if(is_buy) {
              //     bt.soft.product_pay_view({
              //       name:dataRes.title,
              //       pid:dataRes.pid,
              //       type:dataRes.type,
              //       plugin:true,
              //       renew:-1,
              //       ps:dataRes.ps,
              //       ex1:dataRes.ex1,
              //       totalNum:141
              //     })
              //   }else{
              //     bt.soft.install('task_manager')
              //   }
							// }
            });
          })
          //展示收起
          $(layero)
            .find('.disk-item-header')
            .on('click', function () {
              if ($(this).parent().hasClass('base_html')) return;
              if ($(this).parent().hasClass('active')) {
									$(this).parent().removeClass('active');
									$(this).find('span').text('展开');
									$(this).find('img').removeAttr('style');
              } else {
                $(this).parent().addClass('active');
								$(this).find('span').text('折叠');
                $(this).find('img').css('transform', 'rotate(180deg)');
              }
              var name = $(this).parents('.layui-layer-content').prop('id') + '_' + $(this).parents('.disk-item-list').prop('id')
              bt.set_storage(name, $(this).parent().hasClass('active') ? 1 : '')
            });
        },
			});
    }
    /**
     * 关于浮窗如何取消的一系列动作
     * @param dom_point
     * @param father_point
     * @param open
     */
    var cancel_float_box = function (dom_point, father_point) {
      if (postion_time) {
        clearInterval(postion_time);
      }
      //监听鼠标是否在浮窗内
      postion_time = setInterval(function () {
        if ($(dom_point).length != 0) {
          var diskX = $(dom_point).offset().left,
            diskY = $(dom_point).offset().top,
            diskW = $(dom_point).width(),
            diskH = $(dom_point).height();
          var diskChartY = $(father_point).offset().top,
            diskChartX = $(father_point).offset().left,
            diskChartW = $(father_point).width(),
            diskChartH = $(father_point).height();
          var is_move_disk = mouseX >= diskChartX && mouseX <= diskChartX + diskChartW && mouseY >= diskChartY && mouseY <= diskChartY + diskChartH;
          var is_move = mouseX >= diskX && mouseX <= diskX + diskW && mouseY >= diskY && mouseY <= diskY + diskH;
          if (!is_move && !is_move_disk && !table_confirm_show) {
            $(dom_point).remove();
            clearTimeout(time)
            clearInterval(layer_table_time)
          }
        } else {
          clearInterval(postion_time);
        }
      }, 200);
    }
    bt.site.get_msg_configs(function (msg_config) {
      _this.msg_config = msg_config;
      bt_tools.send({url: '/push?action=get_push_list'}, function (res) {
    _this.reander_system_info(function (rdata) {
          _this.cache_system_push = res.system_push;
          _this.all_data()
          var isLoad = !$.isEmptyObject(_this.all_status.load),
              isCpu = !$.isEmptyObject(_this.all_status.cpu),
              isMem = !$.isEmptyObject(_this.all_status.mem),
              isDisk = false;
      // 负载悬浮事件
      $('#loadChart').hover(
        function () {
          var loadCount = Math.round((rdata.load.one / rdata.load.max) * 100) > 100 ? 100 : Math.round((rdata.load.one / rdata.load.max) * 100);
              loadCount = loadCount < 0 ? 0 : loadCount;
              _this.all_data()
              isLoad = !$.isEmptyObject(_this.all_status.load)
          float_box({
            table: {
              type: 'CPU_high_occupancy_software_list',
              table_title: ['CPU占用率', '运行时间'],
              table_fid: ['cpu_percent', 'proc_survive'],
            },
            html: {
              // slot: '<div class="mem-title">\
              //                 <span>检测到当前负载【<span class="load_text ' +
              //   (loadCount >= 80 ? (loadCount >= 90 ? 'color-red' : 'color-org') : 'color-green') +
              //   '">' +
              //   (loadCount >= 80 ? '运行不稳定' : '运行流畅') +
              //   '</span>】</span>\
              //             <button type="button" title="立即优化" class="btn btn-success " id="task_manager_btn">立即优化</button></div>',
                  slot: '<div class="mem-title">\
                                  <span>检测到当前负载<span class="load_text ' +
                    (loadCount >= 80 ? (loadCount >= 90 ? 'color-red-box' : 'color-org-box') : 'color-green-box') +
                    '">运行达到' + loadCount+'%' +
                    '</span></span></div>',
              base_html:
                '\
                <div class="disk-body-list">\
                    <span>最近1/5/15分钟平均负载：</span>\
                        <span id="load_one">' + rdata.load.one + '  /  ' + rdata.load.five + '  /  ' + rdata.load.fifteen + '</span>\
                </div>\
                <div class="disk-body-list">\
                      <span>活动进程数 / 总进程数：</span>\
                      <span id="load_cpu_times_num">' + rdata.cpu_times['活动进程数'] + '  /  ' + rdata.cpu_times['总进程数'] + '</span>\
                    </div>\
                    <hr style="width: calc(100% - 16px);margin: 14px auto;">\
                    <div class="disk-body-alarm">\
                      <div class="flex align-center">告警\
                          <span class="bt_switch ml8" style="display:inline-block;"><input class="btswitch btswitch-ios" id="loadTips" type="checkbox" ' + (_this.all_status.load['status'] ? 'checked' : '') + '>\
                          <label class="btswitch-btn" for="loadTips" style="margin: 0;"></label>\
                        </span>\
                        <div class="vertical-line"></div>\
                        <a class="btlink set_alarm_status" data-type="load" href="javascript:;">设置</a>\
                          <span class=" c9 ml8 load_alarm_tips">5分钟内平均负载超过' + (isLoad ? _this.all_status.load.count : '80') + '%触发</span>\
                      </div>\
                </div>',
              title: '更多负载信息',
              // disk_title: '<i class="new-file-icon new-ltd-icon mr4" style="vertical-align: text-top;"></i>CPU占用TOP5的进程信息',
              disk_title: 'CPU占用TOP5的进程信息',
							cpu_times: rdata.cpu_times,
              isShow: bt.get_cookie('ltd_end') > 0,
              typeName: 'CPU',
              table_id: 'loadCPUTable',
              position: '#loadChart',
              newClass: 'load_tips_point'
            }
          })
        },
        function () {
          cancel_float_box('.load_tips_point', '#loadChart');
        }
      )

      // cpu悬浮事件
      $('#cpuChart').hover(
        function () {
          var cpuCount = rdata.cpu[0];
              _this.all_data()
              isCpu = !$.isEmptyObject(_this.all_status.cpu)
          float_box({
            table: {
              type: 'CPU_high_occupancy_software_list',
              table_title: ['CPU占用率', '运行时间'],
              table_fid: ['cpu_percent', 'proc_survive'],
            },
            html: {
              // slot: '<div class="mem-title">\
              //                 <span>检测到当前CPU【<span class="cpu_text ' +
              //   (cpuCount >= 80 ? (cpuCount >= 90 ? 'color-red' : 'color-org') : 'color-green') +
              //   '">' +
              //   (cpuCount >= 80 ? '占用过高' : cpuCount+'%') +
              //   '</span>】</span>\
              //             <button type="button" title="立即优化" class="btn btn-success " id="task_manager_btn">立即优化</button></div>',
                  slot: '<div class="mem-title">\
                                  <span>检测到当前CPU<span class="cpu_text ' +
                    (cpuCount >= 80 ? (cpuCount >= 90 ? 'color-red-box' : 'color-org-box') : 'color-green-box') +
                    '">占用' + cpuCount+'%' +
                    '</span></span></div>',
              base_html:
                '\
                <div class="disk-body-list">\
                  <span>' + rdata.cpu[3] + '</span>\
                </div>\
                <div class="disk-body-list">\
                  <span>' + rdata.cpu[5] + '个物理CPU，' + rdata.cpu[4] + '个物理核心，' + rdata.cpu[1] + '个逻辑核心</br>' + '</span>\
                    </div>\
                    <hr style="width: calc(100% - 16px);margin: 14px auto;">\
                    <div class="disk-body-alarm">\
                      <div class="flex align-center">告警\
                        <span class="bt_switch ml8" style="display:inline-block"><input class="btswitch btswitch-ios" id="cpuTips" type="checkbox" '+ (_this.all_status.cpu['status'] ? 'checked' : '') +'>\
                          <label class="btswitch-btn" for="cpuTips" style="margin: 0;"></label>\
                        </span>\
                        <div class="vertical-line"></div>\
                        <a class="btlink set_alarm_status" data-type="cpu" href="javascript:;">设置</a>\
                        <span class="c9 ml8 cpu_alarm_tips">5分钟内平均CPU超过'+ (isCpu ? _this.all_status.cpu.count : '80') +'%触发</span>\
                      </div>\
                </div>',
              title: '核心使用率',
              // disk_title: '<i class="new-file-icon new-ltd-icon mr4" style="vertical-align: text-top;"></i>CPU占用TOP5的进程信息',
              disk_title: 'CPU占用TOP5的进程信息',
              cpu_times: rdata.cpu[2],
              isShow: bt.get_cookie('ltd_end') > 0,
							typeName: 'CPU',
              table_id: 'loadCPUTable',
              position: '#cpuChart',
              newClass: 'load_CPU_tips_point'
            }
          })
        },
        function () {
          cancel_float_box('.load_CPU_tips_point', '#cpuChart')
        }
      )

      $('#memChart').hover(
        function () {
              _this.all_data()
              isMem = !$.isEmptyObject(_this.all_status.mem)
          float_box({
            table: {
              type: 'memory_high_occupancy_software_list',
              table_title: ['内存占用率', '运行时间'],
              table_fid: ['memory_usage', 'proc_survive'],
            },
            html: {
              base_html: '<div class="disk-body-list">\
                    <span>可用内存：</span>\
                    <span id="mem_Free">' + rdata.mem.memFree + 'MB</span>\
                </div>\
                <div class="disk-body-list" title="由内核自动分配buffer/cache缓存大小，以提高文件系统性能和整体系统的响应速度">\
                      <span>Buffer和Cache共占用内存：</span>\
                      <span id="mem_buffer_cache">' + (rdata.mem.memBuffers + rdata.mem.memCached) + 'MB</span>\
                    </div>\
                    <hr style="width: calc(100% - 16px);margin: 14px auto;">\
                    <div class="disk-body-alarm">\
                      <div class="flex align-center">告警\
                        <span class="bt_switch ml8" style="display:inline-block"><input class="btswitch btswitch-ios" id="memTips" type="checkbox" '+ (_this.all_status.mem['status'] ? 'checked' : '') +'>\
                          <label class="btswitch-btn" for="memTips" style="margin: 0;"></label>\
                        </span>\
                        <div class="vertical-line"></div>\
                        <a class="btlink set_alarm_status" data-type="mem" href="javascript:;">设置</a>\
                        <span class="c9 ml8 mem_alarm_tips">5分钟内内存使用率超过'+ (isMem ? _this.all_status.mem.count : '80') +'%触发</span>\
                      </div>\
                </div>',
              slot: '<div class="mem-title">\
                    <span>检测到当前内存<span class="mem_text ' +
                    (((rdata.mem.memRealUsed / rdata.mem.memTotal) * 100).toFixed(2) >= 80 ? (((rdata.mem.memRealUsed / rdata.mem.memTotal) * 100).toFixed(2) >= 90 ? 'color-red-box' : 'color-org-box') : 'color-green-box') +
                    '">占用' +
                    ((rdata.mem.memRealUsed / rdata.mem.memTotal) * 100).toFixed(2) +
                    '%</span></span>\
                          <button type="button" title="立即清理" class="btn btn-success " id="mem_scanning_btn">立即清理</button></div>',
              // disk_title: '<i class="new-file-icon new-ltd-icon mr4" style="vertical-align: text-top;"></i>内存占用TOP5的进程信息',
              disk_title: '内存占用TOP5的进程信息',
              isShow: bt.get_cookie('ltd_end') > 0,
              typeName: '内存',
              table_id: 'loadMEMTable',
              position: '#memChart',
              newClass: 'load_MEM_tips_point'
            }
          })
        },
        function () {
          cancel_float_box('.load_MEM_tips_point', '#memChart')
        }
      )

      // 磁盘悬浮事件
          var is_remove_disk = [], idx = 0, taskStatus = []//扫描状态
      for (var i = 0; i < rdata.disk.length; i++) {
        if(_this.alarm_type_list.length == 3+i) _this.alarm_type_list.push({title: '磁盘【' + rdata.disk[i].path + '】告警', value: rdata.disk[i].path})
        is_remove_disk.push(true)
        taskStatus.push(false)
        var mouseX = 0, mouseY = 0;
        $(document).mousemove(function (e) {
          mouseY = e.pageY
          mouseX = e.pageX
        })
        var diskInterval = null
            _this.all_status.disk = {}
            $('#diskChart' + i).data('disk', rdata.disk[i]).hover(function () {
          var disk = $(this).data('disk')
              _this.all_data(disk.path)
              isDisk = !$.isEmptyObject(_this.all_status.disk[disk.path])

          clearInterval(diskInterval)
          var top = $(this).offset().top,
          left = $(this).offset().left,
          used_size = parseFloat(disk.size[3].substring(0, disk.size[3].lastIndexOf("%")));
          idx = $(this).prop('id').replace('diskChart', '')
              for (var i = 0; i < is_remove_disk.length; i++) {
                if (i !== parseInt(idx) && is_remove_disk[i]) {
                  $('.disk_scanning_tips' + i).remove()
            }
          }
              if (!$('.disk_scanning_tips' + idx).length) {
                var is_active = bt.get_storage('disk_scanning_tips_' + idx)
                //<div class="disk-body-list"><div class="progressBar"><span style="left: '+ (used_size < 12 ? (used_size + 2) : (used_size-11)) +'%;'+ (used_size < 12 ? 'color:#666;':'') +'">'+ disk.size[3] +'</span><div style="width: '+ disk.size[3] +'; '+ (used_size === 100 ? 'border-radius: 2px;' : '') +'" class="progress '+ (used_size >= 80 ? used_size >= 90 ? 'bg-red' : 'bg-org' : 'bg-green') +'"></div></div></div>\
            layer.open({
              type: 1,
              closeBtn: 1,
              shade: 0,
              area: '340px',
              title: false,
                  skin: 'disk_scanning_tips disk_scanning_tips' + idx,
                  content: '<div class="pd20 disk_scanning" data-index="'+ idx +'">\
                          <div class="disk_cont">\
                            <div class="disk-title">\
                                  <span>检测到当前磁盘<span class="'+ ( used_size >= 80 ? used_size >= 90 ? 'color-red-box' : 'color-org-box' : 'color-green-box' ) +'">空间占用'+ used_size +'%</span></span>\
                                <button type="button" data-path="' + disk.path + '" title="立即清理" class="btn btn-success disk_scanning_btn">立即清理</button></div>\
                            <div class="disk-item-list active">\
                              <div class="disk-item-header">\
                                <div class="disk-header-title">基础信息</div>\
                              </div>\
                              <div class="disk-item-body">\
                                  <div class="disk-body-list">类型：' + disk.type + '</div>\
                                  <div class="disk-body-list more_wrap"><div>挂载点：</div><div>' + disk.path + '</div></div>\
                                  <div class="disk-body-list use_disk" style="margin-top: 6px;white-space: pre-line;">可用：' + parseFloat(disk.size[2]) + ' ' + disk.size[2].replace(parseFloat(disk.size[2]), '') + '，共：' + parseFloat(disk.size[0]) + ' ' + disk.size[0].replace(parseFloat(disk.size[0]), '') + '\n已用：' + parseFloat(disk.size[1]) + ' ' + disk.size[1].replace(parseFloat(disk.size[1]), '') + '，系统占用：' + disk.size[4] + '</div>\
                                    <hr style="width: calc(100% - 16px);margin: 14px auto;">\
                                    <div class="disk-body-alarm">\
                                      <div class="flex align-center">告警\
                                        <span class="bt_switch ml8" style="display:inline-block">\
                                          <input class="btswitch btswitch-ios" id="diskTips" type="checkbox" '+ (_this.all_status.disk[disk.path] && _this.all_status.disk[disk.path]['status'] ? 'checked' : '') +'>\
                                          <label class="btswitch-btn" for="diskTips" style="margin: 0;"></label>\
                                        </span>\
                                        <div class="vertical-line"></div>\
                                        <a class="btlink set_alarm_status" data-spacesize="'+ parseFloat(disk.size[0]) +'" data-type="disk" data-project="'+ disk.path +'" href="javascript:;">设置</a>\
                                        <span class="c9 ml8 disk_alarm_tips">该磁盘'+ (isDisk ? _this.all_status.disk[disk.path].cycle == 1 ? '余量不足' + _this.all_status.disk[disk.path].count + 'GB' : '用量超过'+ _this.all_status.disk[disk.path].count +'%' : '空间占用超过80%' ) + '触发</span>\
                                      </div>\
                                    </div>\
																</div>\
                            </div>\
                              <div class="disk-item-list ' + (is_active ? 'active' : '') + '">\
                              <div class="disk-item-header">\
                                <div class="disk-header-title">更多磁盘信息</div>\
                                    <div class="disk-header-fold flex">\
                                      <span class="mr8">'+ (is_active ? '折叠' : '展开') +'</span>\
                                      <img src="/static/img/arrow-down.svg" '+ (is_active ? 'style="transform: rotate(180deg);"' : '') +' class="icon-index-arrow">\
                                </div>\
															</div>\
                              <div class="disk-item-body">\
                                  <div class="disk-body-list more_wrap"><div>文件系统：</div><div>' + disk.filesystem + '</div></div>\
                                  <div class="disk-body-list inodes0">Inode总数：' + disk.inodes[0] + '</div>\
                                  <div class="disk-body-list inodes1">Inode已用：' + disk.inodes[1] + '</div>\
                                  <div class="disk-body-list inodes2">Inode可用：' + disk.inodes[2] + '</div>\
                                  <div class="disk-body-list inodes3">Inode使用率：' + disk.inodes[3] + '</div>\
                              </div>\
                            </div>\
                          </div>\
                          <div class="disk_scan_cont hide">\
                            <div class="disk-scan-header">\
                                <button type="button" title="后退" class="btn btn-default disk_back_btn" data-index="' + idx + '" ><span class="disk_back_icon"></span><span>后退</span></button>\
                              <div>磁盘扫描</div>\
                            </div>\
                            <div class="disk-scan-view hide">\
                              <pre id="scanProgress">正在获取扫描日志</pre>\
                            </div>\
                            <div class="disk-file-view hide">\
                            <div class="disk-file-load" style="position:absolute;width: 100%;height: 100%;top: 0;left:0;display: none;z-index: 99999999;background:rgba(0,0,0,0.3);align-items:center;justify-content: center;">\
                                <div class="pd15" style="background: #fff;">\
                                  <img src="/static/img/loading.gif" class="mr10">\
                                  <span>正在获取文件信息，请稍后...</span>\
                                </div>\
                              </div>\
                              <div class="filescan-nav" id="fileScanPath"></div>\
                              <div class="filescan-list" id="fileScanTable">\
                                <div class="filescan-list-title">\
                                  <div class="filescan-list-title-item text-left">文件名</div>\
                                  <div class="filescan-list-title-item">大小</div>\
                                  <div class="filescan-list-title-item text-right">操作</div>\
                                </div>\
                                <div class="filescan-list-body"></div>\
                              </div>\
                            </div>\
                          </div>\
                        </div>',
              success: function (layero, index) {
                $(layero).find('#diskTips').prop('checked', false)
                $(layero).find('.disk_alarm_tips').text('该磁盘空间占用超过80%触发')
                for (var key in _this.cache_system_push) {
                  var item = _this.cache_system_push[key]
                  if (item.type === 'disk' && item.project === disk.path) {
                    $(layero).find('#diskTips').prop('checked', item.status)
                    $(layero).find('.disk_alarm_tips').text('该磁盘' + (item.cycle == 1 ? '余量不足' + item.count + 'GB' : '用量超过' + item.count + '%') + '触发')
                  }
                }
                    $(layero).find('.bt_switch input').each(function (index, item) {
                      $(this).change(function () {
                        var status = $(this).prop('checked'),
                            name = $(this).parent().parent().find('.set_alarm_status').data('type'),
                            project = $(this).parent().parent().find('.set_alarm_status').data('project'),
                            space_size = $(this).parent().parent().find('.set_alarm_status').data('spacesize'),
                            alarm_id = '';
                        var alarm_data = _this.get_alarm_data(name, project)
                        alarm_id = alarm_data['id'] ? alarm_data['id'] : ''
                        //id 不存在则添加告警 id 存在则开启/关闭告警
                        if(!status) { //存在告警关闭告警
                          bt.simple_confirm({title: '关闭告警',msg:'关闭告警后，将不再接收到该项的告警信息，是否继续操作？'}, function () {
                            _this.set_push_status(alarm_id, 0)
                          },function() {
                            $('#'+ name +'Tips').prop('checked', !$('#'+ name +'Tips').is(':checked'))
                          })
                        }else{ //不存在告警添加告警 或者 存在则开启告警
                          if(alarm_id){
                            bt.simple_confirm({title: '开启告警',msg:'开启告警后，达到触发条件会收到该项的告警信息，是否继续操作？'}, function () {
                              _this.set_push_status(alarm_id, 1)
                            },function() {
                              $('#'+ name +'Tips').prop('checked', !$('#'+ name +'Tips').is(':checked'))
                            })
                          }else{
                            var data = {
                              type: name,
                              cycle: 2,
                              project: project,
                              space_size: space_size
                            }
                            _this.open_alarm(data, true)
                          }
                        }
                      })
                      $(this).parent().parent().find('.set_alarm_status').click(function () {
                        var name = $(this).data('type'),
                            project = $(this).data('project'),
                            space_size = $(this).data('spacesize'),
                            alarm_id = '';
                        var alarm_data = _this.get_alarm_data(name,project)
                        alarm_id = alarm_data['id'] ? alarm_data['id'] : ''
                        if(alarm_id) {
                          alarm_data['space_size'] = space_size
                          _this.open_alarm(alarm_data)
                        } else {
                          var data = {
                            type: name,
                            cycle: 2,
                            project: project,
                            space_size: space_size
                          }
                          _this.open_alarm(data)
                        }
                      })
                    })

                is_remove_disk[idx] = true
                // $(layero).find('.layui-layer-close2').addClass('layui-layer-close1').removeClass('layui-layer-close2');
                $(layero).find('.layui-layer-close2').remove()
                $(layero).css({
                      'top': (top + 140 - $(window).scrollTop()) + 'px',
                  'left': left - 160,
                })
                $(window).resize(function () {
                      for (var i = 0; i < is_remove_disk.length; i++) {
                        if ($('.disk_scanning_tips' + i).length) {
                          $('.disk_scanning_tips' + i).css({
                            'top': ($("#diskChart" + i).offset().top + 140 - $(window).scrollTop()) + 'px',
                        'left': $("#diskChart" + i).offset().left - 160,
                      })
                    }
                  }
                })
                $(window).scroll(function () {
                  $(layero).css({
                        'top': ($("#diskChart" + idx).offset().top + 140 - $(window).scrollTop()) + 'px',
                    'left': $("#diskChart" + idx).offset().left - 160,
                  })
                })
                var id = null, // 扫描id
                    taskPath = '', // 扫描目录
                    taskList = {}; // 扫描缓存列表
                //展示收起
                $(layero).find('.disk-item-header').on('click', function () {
                  if ($(this).parent().hasClass('active')) {
                    $(this).parent().removeClass('active');
                    $(this).find('span').text('展开');
                    $(this).find('img').removeAttr('style');
                  } else {
                    $(this).parent().addClass('active');
                    $(this).find('span').text('折叠');
                    $(this).find('img').css('transform', 'rotate(180deg)');
                  }
                  var name = 'disk_scanning_tips_' + idx
                  bt.set_storage(name, $(this).parent().hasClass('active') ? 1 : '')
                })

                // 后退
                $(layero).find('.disk_back_btn').on('click', function () {
                  var path = $(this).data('path'),
                      index = $(this).data('index')
                      if (path !== undefined && path !== 'undefined') {
                        if (path === '') {
                      $(layero).find('.filescan-nav-item.present').click()
                      $(this).data('path', 'undefined');
                        } else {
                          var rdata = taskList[path.replace('//', '/')];
                      renderFilesTable(rdata, path); // 渲染文件表格
                      renderFilesPath(path); // 渲染文件路径
                    }
                      } else {
                        if (taskStatus[index]) {
                      layer.confirm(
                        '取消扫描，将会中断当前扫描目录进程，是否继续？',
                        {
                          title: '取消扫描',
                          closeBtn: 2,
                          icon: 3,
                        },
                        function (indexs) {
                          taskStatus[index] = false;
                          layer.close(indexs);
                          cancelScanTaskRequest(id, function (rdata) {
                            if (!rdata.status) return bt_tools.msg(rdata);
                            renderInitView();
                          });
                        }
                      );
                        } else {
                      renderInitView();
                    }
                  }
                })

                /**
                 * @description 渲染扫描初始化页面
                 */
                function renderInitView() {
                  id = null
                  taskStatus[idx] = false
                  taskPath = ''
                  taskList = {}
                  $(layero).find('.disk_cont').removeClass('hide').siblings('.disk_scan_cont').addClass('hide');
                  $(layero).find('.layui-layer-close1').show()
                  $(layero).find('.disk-file-view,.disk-scan-view').addClass('hide');
                      $(layero).find('.disk-file-load').css('display', 'none')
                }

                // 扫描
                $(layero).find('.disk_scanning_btn').unbind('click').on('click', function () {
                  // if(taskStatus.some(function (item){ return item === true })) {
                    // if(bt.get_cookie('taskStatus') === 'true') {
                    //   return layer.tips('有任务在执行，请稍后再操作！', $(this), {tips: [3, '#f00']});
                    // }
                    is_remove_disk[idx] = false;
                    var $path = $(this).data('path');
                    //判断是否安装插件
                      bt.soft.get_soft_find('disk_analysis', function (dataRes) {
                        if (dataRes.setup && dataRes.endtime > 0) {
                        layer.closeAll()
                        bt.set_cookie('diskPath', $path)
                        bt.set_cookie('taskStatus', true)
                          bt.soft.set_lib_config(dataRes.name, dataRes.title, dataRes.version)
                        } else {
                      // var item = {
                      //   name: 'disk_analysis',
                      //   pluginName: '堡塔硬盘分析工具',
                      //   ps: '急速分析磁盘/硬盘占用情况',
                      //   preview: false,
                      //   limit: 'ltd',
                      //   description:['检测硬盘空间','占用百分比显示'],
                      //   imgSrc:'https://www.bt.cn/Public/new/plugin/disk_analysis/1.png'
                      // }
                      // product_recommend.recommend_product_view(item, {
                      //   imgArea: ['783px', '718px']
                      // },'ltd',120,item.name)
                      var is_buy = dataRes.endtime < 0 && dataRes.pid > 0
                      // $('.buyNow').text(is_buy ? '立即购买' : '立即安装').unbind('click').click(function () {
                          if (is_buy) {
                          bt.soft.product_pay_view({
                              name: dataRes.title,
                              pid: dataRes.pid,
                              type: dataRes.type,
                              plugin: true,
                              renew: -1,
                              ps: dataRes.ps,
                              ex1: dataRes.ex1,
                              totalNum: 120
                          })
                          } else {
                          bt.soft.install('disk_analysis')
                        }
                      // })
                    }
                  })
                  return
                  var ltd = bt.get_cookie('ltd_end')
                 	if (ltd < 0) {
                   var item = {
                        name: 'disk_analysis',
                        pluginName: '堡塔硬盘分析工具',
                        ps: '急速分析磁盘/硬盘占用情况',
                        preview: false,
                        limit: 'ltd',
                          description: ['检测硬盘空间', '占用百分比显示'],
                          imgSrc: 'https://www.bt.cn/Public/new/plugin/disk_analysis/1.png'
                      }
                    bt.soft.product_pay_view({ totalNum: 120, limit: 'ltd', closePro: true,pluginName:'堡塔硬盘分析工具',fun:function () {
                        product_recommend.recommend_product_view(item, {
                          imgArea: ['783px', '718px']
                        }, 'ltd', 120, item.name,true)
                      }})
                      } else {
                    $.post('/files/size/scan_disk_info', {path: $path}, function (rdata) {
                          if (!rdata.status) {
                            if (rdata['code'] && rdata['code'] === 404) {
                          bt.soft.install('disk_analysis')
                        }
                          } else {
                        var $scanView = $(layero).find('.disk-scan-view');
                        var shellView = $(layero).find('.disk-scan-view pre');
                        $scanView.removeClass('hide');
                        $(layero).find('.disk-file-view').addClass('hide')
                        $(layero).find('.disk_cont').addClass('hide').siblings('.disk_scan_cont').removeClass('hide');
                        taskStatus[$(layero).find('.disk_scanning').data('index')] = true;
                            renderScanTitle(shellView, '开始扫描磁盘目录\n', true)
                            renderScanTitle(shellView, '<span style="display:flex;" class="omit">目录正在扫描中<span>\n')
                        renderTaskSpeed(function (rdata) {
                          id = rdata.id;
                              $(layero).find('.disk_scanning').data('id', id)
                            }, function () {
                          renderScanTitle(shellView, '扫描完成，等待扫描结果返回\n');
                          renderFilesView({
                            path: $path,
                            init: true,
                          });
                        })
                      }
                    })
                  }
                })

                /**
                 * @description 渲染文件列表
                 * @param {Object} data 数据
                 */
                function renderFilesView(data, flag) {
                  var param = {
                    root_path: data.path
                  }
                  if (data['subdir']) param.path = data.subdir;
                  if (flag) $(layero).find('.disk-file-load').css('display', 'flex')
                  bt_tools.send({url: '/files/size/get_scan_log', data: param}, function (rdata) {
                    if (flag) $(layero).find('.disk-file-load').css('display', 'none')
                    var $fileView = $(layero).find('.disk-file-view');
                    $fileView.removeClass('hide').prev().addClass('hide');
                    var path = rdata.fullpath
                    path = path.replace(/(\\)+/g, '/');
                    if (data.init) taskPath = path;
                    if (!taskList.hasOwnProperty(path)) taskList[path] = rdata;
                    renderFilesTable(rdata, path);
                    renderFilesPath(path);
                  });
                }

                // 渲染文件表格
                function renderFilesTable(rdata, path) {
                  var $fileTableBody = $(layero).find('.filescan-list-body');
                  var list = rdata.list;
                  var html = '';
                  for (var i = 0; i < list.length; i++) {
                    var item = list[i];
                    var isDir = item.type == 1
                    html +=
                      '<div class="filescan-list-item" data-type="' +
                      (isDir ? 'folder' : 'files') + '" data-subdir="' + rdata.fullpath + '/' + item.name + '" data-path="' +
                      (path + '/' + item.name) +
                      '">' +
                      '<div class="filescan-list-col text-left nowrap" title="' +
                      (path + '/' + item.name).replace('//', '/') +
                      '">' +
                      '<span class="file-type-icon file_' +
                      (isDir ? 'folder' : 'icon') +
                      '"></span>' +
                      '<a class="path cut-path cursor" data-type="' +
                      (isDir ? 'folder' : 'files') +
                      '" data-path="' +
                      (path + '/' + item.name) +
                      '">' +
                      item.name +
                      '</a>' +
                      '</div>' +
                      '<div class="filescan-list-col text-left nowrap">' +
                      bt.format_size(isDir ? item.total_asize : item.asize) +
                      '</div>' +
                      '<div class="filescan-list-col text-right">' +
                      '<a href="javascript:;" data-filename="' + item.name + '" data-fullpath="' + rdata.fullpath + '" data-path="' +
                      (path + '/' + item.name) +
                      '" data-type="' +
                      (isDir ? '文件夹' : '文件') +
                      '" class="btlink remove-files">删除</a>' +
                      '</div>' +
                      '</div>';
                  }
                  $fileTableBody.html(html);
                  // 删除文件
                  $(layero).find('.remove-files').click(function (e) {
                    var path = $(this).data('path'),
                      type = $(this).data('type'),
                      fullpath = $(this).data('fullpath'),
                      filename = $(this).data('filename');
                    delFileDir(
                      {
                        path: path,
                        type: type,
                        filename: filename,
                      },
                      function (rdata) {
                        bt_tools.msg(rdata);
                            var list = taskList[fullpath].list.filter(function (item) {
                              return item.name !== filename.toString()
                            })
                        taskList[fullpath].list = list;
                        renderFilesTable(taskList[fullpath], fullpath);
                      }
                    );
                    e.stopPropagation();
                  });
                  // 打开目录
                  $(layero).find('.filescan-list-item').click(function () {
                    var root_path = $(layero).find('.disk_scanning_btn').data('path')
                    var path = $(this).data('subdir'),
                      type = $(this).data('type');
                    if (type !== 'folder' && typeof type !== 'undefined') return false;
                    if (!taskList.hasOwnProperty(path.replace('//', '/'))) {
                      renderFilesView({
                        path: root_path,
                        subdir: path,
                      }, true);
                    } else {
                      var rdata = taskList[path.replace('//', '/')];
                      renderFilesTable(rdata, path); // 渲染文件表格
                      renderFilesPath(path); // 渲染文件路径
                    }
                  });
                }

                // 渲染文件路径
                function renderFilesPath(path) {
                  var html = '';
                  var newPath = '';
                  var pathArr = [];
                  var isLevel = false;
                  var isInit = true;
                  var omission_li = []
                  pathArr = path.replace(taskPath.replace(/(\/\/)+/g, '/'), '').split('/');
                  if (pathArr.length >= 1 && pathArr[0] !== '') pathArr.unshift('');
                  if (pathArr.length > 1 && pathArr[1] !== '') {
                    var upperPath = (getDirPath(path, false) + '/').replace(/(\/\/)+/g, '/');
                    if (pathArr.length > 1) upperPath = upperPath.replace(/\/$/g, '');
                    $(layero).find('.disk_back_btn').data('path', upperPath);
                  }
                  if (pathArr.length > 2) isInit = true;
                  for (var i = 0; i < pathArr.length; i++) {
                    var element = pathArr[i];
                    newPath += '/' + element;
                    if (element === '' && i > 0) continue;
                    var isLast = pathArr.length - 1 === i;
                    var isFirst = i === 0;
                    var currentPath = isFirst ? taskPath : taskPath + newPath;
                    var divider = !isLast ? '<span class="divider">></span>' : '';
                    var menuPath = isFirst ? '当前目录(' + taskPath + ')' : element;
                    currentPath = currentPath.replace(/\/\//g, '/');
										if (i > 1 && i < pathArr.length - 1 && pathArr.length > 3) {
                      if (isInit) {
                        html += '<span class="omission">\
                        <a class="btlink" title="部分目录已经省略">...</a>\
                        <ul></ul>\
                        </span><span class="divider">></span>';
                      }
                      omission_li.push({menuPath: element, currentPath: currentPath})
                      isInit = false;
                    } else {
                      html +=
                        '<a class="filescan-nav-item nowrap ' + (isLevel && !isLast ? 'btlink cut-path' : '') + (isFirst ? ' present' : '') + '" data-path="' + currentPath + '" title="' + currentPath + '">' + menuPath + '</a>' + divider;
                    }
                  }
                  $(layero).find('#fileScanPath').html(html);
									if (omission_li.length > 0) {
                    var omission = $(layero).find('.omission')
                    var ul = omission.find('ul')
                    for (var i = 0; i < omission_li.length; i++) {
                      var element = omission_li[i];
                      ul.append('<li><a class="filescan-nav-item cut-path" data-path="' + element.currentPath + '" title="' + element.currentPath + '"><i class="file_folder_icon"></i><span>' + element.menuPath + '</span></a></li>')
                    }
                    $(layero).find('.omission').click(function (e) {
											if ($(this).hasClass('active')) {
                        $(this).removeClass('active')
											} else {
                        $(this).addClass('active')
                      }
                      $(document).click(function (ev) {
                        $(layero).find('.omission').removeClass('active')
                        ev.stopPropagation();
                        ev.preventDefault();
                      });
                      e.stopPropagation();
                      e.preventDefault();
                    })
                  }
                  //打开目录按钮
                  $(layero).find('#fileScanPath .filescan-nav-item').click(function () {
                    var root_path = $(layero).find('.disk_scanning_btn').data('path')
                    var path = $(this).data('path'),
                      type = $(this).data('type');
										if (type !== 'folder' && typeof type != 'undefined') return layer.msg('文件暂不支持打开', {icon: 0});
										if (!taskList.hasOwnProperty(path.replace('//', '/'))) {
                      renderFilesView({
                        path: root_path,
                        subdir: path,
                      });
                    } else {
											var rdata = taskList[path.replace('//', '/')];
                      renderFilesTable(rdata, path); // 渲染文件表格
                      renderFilesPath(path); // 渲染文件路径
                    }
                  })
                }

                	/**
                 * @description 获取目录地址
                 * @param {string} path 路径
                 * @param {number} param 参数
                 */
                function getDirPath(path, param) {
                  path.replace(/\/$/, '');
                  var pathArr = path.split('/');
                  if (pathArr.length === 1) return path;
                  if (param === -1) pathArr.push(status);
                  if (typeof param === 'boolean') pathArr.pop();
                  return pathArr.join('/').replace(/(\/)$/, '');
                }

                /**
                 * @description 渲染文件追加功能
                 * @param {Element} el 控制器
                 * @param {String} html 文本
                 * @param {Boolean} isCover 是否覆盖，默认不覆盖
                 */
                function renderScanTitle(el, html, isCover) {
                  var $el = typeof el === 'string' ? $(layero).find(el) : el;
                  if (isCover) {
                    $el.html(html);
                  } else {
                    $el.append(html);
                  }
                }

                /**
                 * @description 渲染扫描进度
                 * @param {Function} callack 回调函数
                 * @param {Function} end 结束回调函数
                 */
                function renderTaskSpeed(callack, end) {
                  getScanTaskRequest(false, function (rdata) {
                    if (rdata.length === 0 || !taskStatus[$(layero).find('.disk_scanning').data('index')]) {
                      if (end && taskStatus[$(layero).find('.disk_scanning').data('index')]) end(rdata);
                      taskStatus[$(layero).find('.disk_scanning').data('index')] = false;
                      return;
                    }
                    for (var i = 0; i < rdata.length; i++) {
                      var item = rdata[i];
                      if (item.name.indexOf('扫描目录文件大小') > -1) {
                        if (callack) callack(rdata[0]);
                        break;
                      }
                    }
                    // 扫描目录文件大小
                    setTimeout(function () {
                      renderTaskSpeed(callack, end);
                    }, 1000);
                  });
                }

                /**
                 * @description 获取扫描任务
                 * @param {boolean} load 是否显示加载中
                 * @param {function} callback 回调函数
                 */
                function getScanTaskRequest(load, callback) {
                  var isLoad = typeof load === 'function';
                  if (isLoad) callback = load;
                  bt_tools.send(
                    'task/get_task_lists',
                    {
                      status: -3,
                    },
                    function (rdata) {
                      if (callback) callback(rdata);
                    },
                    {
                      load: isLoad ? '获取扫描任务详情' : false,
                    }
                  );
                }

                /**
                 * @description 删除文件或目录
                 * @param {Object} data
                 */
									function delFileDir(data, callback) {
										if (bt.get_cookie('file_recycle_status') === 'true') {
                    bt.simple_confirm({
                        title: '删除' + data.type + '【' + data.filename + '】',
                        msg: '删除' + data.type + '后，' + data.type + '将迁移至文件回收站，<span class="color-org">请确认删除的文件是不需要的文件，误删文件可能会导致系统崩溃，</span>是否继续操作？</span>'
                      }, function () {
                        delFileRequest(data, function (res) {
                          if (callback) callback(res);
                          layer.msg(res.msg, {
                            icon: res.status ? 1 : 2,
                          });
                        });
                      }
                    );
                  } else {
										bt.compute_confirm({
												title: '删除' + data.type + '【' + data.filename + '】',
												msg: '风险操作，当前未开启文件回收站，删除' + data.type + '将彻底删除，无法恢复，<span class="color-org">请确认删除的文件是不需要的文件，误删文件可能会导致系统崩溃，</span>是否继续操作？'
                    }, function () {
                        delFileRequest(data, function (res) {
                          if (callback) callback(res);
                          layer.msg(res.msg, {
                            icon: res.status ? 1 : 2,
                          });
                        });
                      }
                    );
                  }
                }

                /**
                 * @description 删除文件（文件和文件夹）
                 * @param {Object} data 文件目录参数
                 * @param {Function} callback 回调函数
                 * @return void
                 */
                function delFileRequest(data, callback) {
                  var _req = data.type === '文件' ? 'DeleteFile' : 'DeleteDir';
                  bt_tools.send(
                    'files/' + _req,
                    {
                      path: data.path,
                    },
                    function (res) {
                      if (callback) callback(res);
                    },
                    {
                      load: '删除文件/目录',
                    }
                  );
                }
              },
							cancel: function (index, layero) {
								if (taskStatus[$(layero).find('.disk_scanning').data('index')]) {
                    layer.confirm(
                      '取消扫描，将会中断当前扫描目录进程，是否继续？',
                      {
                        title: '取消扫描',
                        closeBtn: 2,
                        icon: 3,
                      },
                      function (indexs) {
                        taskStatus[$(layero).find('.disk_scanning').data('index')] = false
                        layer.close(indexs);
                        layer.close(index)
                        cancelScanTaskRequest($(layero).find('.disk_scanning').data('id'), function (rdata) {
                          if (!rdata.status) return bt_tools.msg(rdata);
                        });
                      }
                    );
                    return false
                }
              }
            })
          }

          /**
           * @description 删除扫描任务
           * @param {string} id 任务id
           * @param {function} callback 回调函数
           */
          function cancelScanTaskRequest(id, callback) {
            bt_tools.send(
              'task/remove_task',
              {
                id: id,
              },
              function (rdata) {
                if (callback) callback(rdata);
              },
              {
                load: '取消扫描任务',
              }
            );
          }
        }, function () {
          diskInterval = setInterval(function () {
            if ($('.disk_scanning_tips' + idx).length) {
							var diskX = $('.disk_scanning_tips' + idx).offset().left,
								diskY = $('.disk_scanning_tips' + idx).offset().top,
								diskW = $('.disk_scanning_tips' + idx).width(), diskH = $('.disk_scanning_tips' + idx).height()
							var diskChartY = $('#diskChart' + idx).offset().top, diskChartX = $('#diskChart' + idx).offset().left,
								diskChartW = $('#diskChart' + idx).width(), diskChartH = $('#diskChart' + idx).height()
              var is_move_disk = mouseX >= diskChartX && mouseX <= diskChartX + diskChartW && mouseY >= diskChartY && mouseY <= diskChartY + diskChartH
              var is_move = mouseX >= diskX && mouseX <= diskX + diskW && mouseY >= diskY && mouseY <= diskY + diskH
                  if (!is_move && !is_move_disk) {
                    $('.disk_scanning_tips' + idx).remove()
              }
						} else {
              clearInterval(diskInterval)
            }
          }, 500)
        })
        if ($('.disk_scanning_tips' + i).length) {
					var disk = $('#diskChart' + i).data('disk')
          var size3 = parseFloat(disk.size[3].substring(0, disk.size[3].lastIndexOf("%")))
					$('.disk_scanning_tips' + i + ' .disk-body-list .progressBar span').text(disk.size[3]).css({
						left: (size3 < 12 ? (size3 + 2) : (size3 - 11)) + '%;',
            color: size3 < 12 ? '#666;' : '#fff'
          })
          var progressCss = {
            width: disk.size[3],
          }
					if (size3 === 100) progressCss.borderRadius = '2px'
					$('.disk_scanning_tips' + i + ' .disk-body-list .progressBar .progress').css(progressCss)
					$('.disk_scanning_tips' + i + ' .disk-body-list .progressBar .progress').removeClass('bg-red bg-org bg-green').addClass(size3 >= 80 ? size3 >= 90 ? 'bg-red' : 'bg-org' : 'bg-green')
					$('.disk_scanning_tips' + i + ' .disk-body-list.use_disk').html(parseFloat(disk.size[2]) + ' ' + disk.size[2].replace(parseFloat(disk.size[2]), '') + '可用，' + parseFloat(disk.size[1]) + ' ' + disk.size[1].replace(parseFloat(disk.size[1]), '') + '已用，共' + parseFloat(disk.size[0]) + ' ' + disk.size[0].replace(parseFloat(disk.size[0]), ''))
					$('.disk_scanning_tips' + i + ' .disk-body-list.inodes0').html('Inode总数：' + disk.inodes[0])
					$('.disk_scanning_tips' + i + ' .disk-body-list.inodes1').html('Inode已用：' + disk.inodes[1])
					$('.disk_scanning_tips' + i + ' .disk-body-list.inodes2').html('Inode可用：' + disk.inodes[2])
					$('.disk_scanning_tips' + i + ' .disk-body-list.inodes3').html('Inode使用率：' + disk.inodes[3])
        }
      }
      _this.get_server_info(rdata);
      if (rdata.installed === false) bt.index.rec_install();
    })
    })
    })
    // setTimeout(function () { _this.get_index_list() }, 400)
    setTimeout(function () { _this.net.init() }, 500);
    setTimeout(function () { _this.iostat.init() }, 500);
    setTimeout(function () { _this.get_warning_list() }, 600);
    // setTimeout(function () { _this.interval.start() }, 700);
    setTimeout(function () {
      bt.system.check_update(function (rdata) {
        index.consultancy_services(rdata.msg.adviser);

        if (rdata.status !== false) {
          var res = rdata.msg, beta = res.beta,is_beta = res.is_beta,ignore = res.ignore;
          if(ignore.indexOf(is_beta?beta.version:res.version) == -1) index.check_update(true) // 判断自动升级
          $('#toUpdate a').html('更新<i style="display: inline-block; color: red; font-size: 40px;position: absolute;top: -35px; font-style: normal; right: -8px;">.</i>');
          $('#toUpdate a').css("position", "relative");

        }
        if (rdata.msg.is_beta === 1) {
          $('#btversion').prepend('<span style="margin-right:5px;">Beta</span>');
          $('#btversion').append('<a class="btlink" href="https://www.bt.cn/bbs/forum-39-1.html" target="_blank">  [找Bug奖宝塔币]</a>');
        }
      }, false)
    }, 700)
  },
  //单个告警信息配置
  all_data: function (project) {
    var _this = this;
    if(!$.isEmptyObject(_this.cache_system_push)){
      for (var key in _this.cache_system_push) {
        var alarmData = _this.cache_system_push[key];
        if(alarmData.type === 'cpu' || alarmData.type === 'mem' || alarmData.type === 'disk' || alarmData.type === 'load'){
          if(project || alarmData.type === 'disk') {
            _this.all_status[alarmData.type][project] = alarmData
          }else{
            _this.all_status[alarmData.type] = alarmData
          }
        }
      }
    }
  },
  //打开弹窗
  open_alarm: function (obj, $check){
    var _this = this;
    var isExpiration = !$.isEmptyObject(obj) ? obj.status : false;
    if ($check) isExpiration = $check
    var title = obj.type == 'load' ? '负载' : obj.type == 'cpu' ? 'CPU' : obj.type == 'mem' ? '内存' : obj.project,
        isDisk = obj.type == 'disk',
        numTitle = obj.type == 'load' ? '负载状态' : obj.type == 'cpu' || obj.type == 'mem' ? '使用率' : isDisk && obj.cycle == 1 ? '剩余容量' : '占用率';
    bt.open({
      type: 1,
      area: '550px',
      title: '告警设置',//【'+ title +'】
      closeBtn: 2,
      btn: ['保存配置', '取消'],
      content: '<div class="bt-form pd16 index_alarm_set">\
                  <div class="line hide">\
                    <span class="tname">告警开关</span>\
                    <div class="info-r line-switch">\
                      <input type="checkbox" id="statusAlarm" class="btswitch btswitch-ios" name="status_alarm" '+ (isExpiration ? 'checked' : '') + ' />\
                      <label class="btswitch-btn" for="statusAlarm"></label>\
                    </div>\
                  </div>\
                  <div class="line">\
                    <span class="tname">任务类型</span>\
                    <div class="info-r">\
                      <div class="inlineBlock  ">\
                        <input type="text" name="type" disabled="disabled" class="bt-input-text mr10 " style="width:310px;" value="'+ _this.alarm_type_list.filter(function (item) {
                          return item.value === (obj.type !== 'disk' ? obj.type : obj.project)
                        })[0].title +'">\
                      </div>\
                    </div>\
                  </div>\
                  <div class="line '+ (isDisk ? '' : 'hide') +'">\
                    <span class="tname">检测类型</span>\
                    <div class="info-r">\
                      <div class="inlineBlock form-radio mr10">\
                        <input type="radio" id="cycle2" name="cycle" value="2" '+ (obj.cycle == 2 ? 'checked' : '') +'>\
                        <label for="cycle2" class="mb0">占用百分比</label>\
                      </div>\
                      <div class="inlineBlock form-radio">\
                        <input type="radio" id="cycle1" name="cycle" value="1" '+ (obj.cycle == 1 ? 'checked' : '') +'>\
                        <label for="cycle1" class="mb0">剩余容量</label>\
                      </div>\
                    </div>\
                  </div>\
                  <div class="line">\
                    <span class="tname numTitle">'+ numTitle +'</span>\
                    <div class="info-r">\
                      <div class="inlineBlock group" style="display: inline-flex;">\
                        <input type="number" name="count" min="0" class="bt-input-text mr10 group" style="width:70px;" value="'+ (obj.hasOwnProperty('count') ? obj.count : 80) +'">\
                        <span class="unit">'+ (isDisk && obj.cycle == 1 ? 'GB' : '%') +'</span>\
                      </div>\
                      <span class="type_tips ml8 c9">每'+ (isDisk ? '隔10' : '5') +'分钟'+ (isDisk ? obj.cycle == 1 ? '磁盘剩余容量低于' : '磁盘占用超过' : '平均' +title + '超过') +'该数值就告警</span>\
                    </div>\
                  </div>\
                  <div class="line">\
                    <span class="tname">发送次数</span>\
                    <div class="info-r">\
                      <div class="inlineBlock group" style="display: inline-flex;">\
                        <input type="number" name="push_count" min="0" class="bt-input-text mr10 group" style="width:70px;" value="'+ (obj.hasOwnProperty('push_count') ? obj.push_count : 3) +'">\
                        <span class="unit">次</span>\
                      </div>\
                      <span class="ml8 c9">后将不再发送告警信息，如需发送多次请填写2次以上</span>\
                    </div>\
                  </div>\
                  <div class="line">\
                    <span class="tname">告警方式</span>\
                    <div class="info-r installPush"></div>\
                  </div>\
                  <ul class="help-info-text c7">\
                    <li>点击配置告警方式后状态未更新，尝试点击【<a class="btlink handRefresh">手动刷新</a>】</li>\
                    <li>【发送次数】设置0时，每天触发告警次数没有上限</li>\
                  </ul>\
                </div>',
      success: function (layero) {
        // bt_tools.form({
        //   el: '.type_alarm_cont',
        //   form: [{
        //     label: '任务类型',
        //     group: {
        //       type: 'select',
        //       name: 'type',
        //       width: '310px',
        //       list: _this.alarm_type_list,
        //       value: obj.type !== 'disk' ? obj.type : obj.project,
        //     }
        //   }]
        // })
        // bt_tools.form({
        //   el: '.type_alarm_cont',
        //   form: [{
        //     label: '任务类型',
        //     group: {
        //       type: 'text',
        //       name: 'type',
        //       disabled: true,
        //       width: '310px',
        //       // list: _this.alarm_type_list,
        //       value: _this.alarm_type_list.filter(function (item) {
        //         return item.value === (obj.type !== 'disk' ? obj.type : obj.project)
        //       })[0].title,
        //     }
        //   }]
        // })
        renderConfigHTML()
        // 手动刷新
        $('.handRefresh').click(function(){
          renderConfigHTML(true)
        })
        $('.index_alarm_set input[type="radio"]').change(function(){
          var val = $(this).val()
          if(val == 2){
            $('.index_alarm_set input[name="count"]').next().text('%')
            $('.index_alarm_set input[name="count"]').val(80)
          }else{
            $('.index_alarm_set input[name="count"]').next().text('GB')
            $('.index_alarm_set input[name="count"]').val(parseInt(obj.space_size*0.2))
          }
          if(isDisk) $('.numTitle').text(val == 2 ? '占用率' : '剩余容量')
          $('.type_tips').text('每'+ (isDisk ? '隔10' : '5') +'分钟'+ (isDisk ? val == 1 ? '磁盘剩余容量低于' : '磁盘占用超过' : '平均' +title + '超过') +'该数值就告警')
        })
        $('.index_alarm_set input[type="number"]').on('input',function(){
          var val = $(this).val()
          if($(this).prop('name') == 'push_count') {
            if(val === '' || val < 0 ) layer.tips('数值不能为负值', $(this), {tips: [1, '#ff0000'],time: 3000});
          }else{
            var cycle = $('input[name="cycle"]:checked').val()
            if(val === '' || val <= 0  || (isDisk && cycle == 2 && val > 100) || (val > 100 && obj.type !== 'disk') ) layer.tips(isDisk && cycle == 1 ? '数值不能小于0' : '数值范围(0,100]', $(this), {tips: [1, '#ff0000'],time: 3000});
          }
        })
        // 获取配置
        function renderConfigHTML(refresh){
          if(refresh || $.isEmptyObject(_this.msg_config)){//手动刷新 或者 全局配置_this.msg_config为空
            bt.site.get_msg_configs(function (rdata) {
              _this.msg_config = rdata
              pubConfig(rdata)
            })
          }else{  //全局配置_this.msg_config不为空
            pubConfig(_this.msg_config)
          }
          function pubConfig(rdata) {
            var html = '', unInstall = ''
            for (var key in rdata) {
              var item = rdata[key],_html = '',accountConfigStatus = false;
              if(key == 'sms') continue;
              if(key === 'wx_account'){
                if(!$.isEmptyObject(item.data) && item.data.res.is_subscribe && item.data.res.is_bound){
                  accountConfigStatus = true   //安装微信公众号模块且绑定
                }
              }
              _html = '<div class="inlineBlock module-check ' + ((!item.setup || $.isEmptyObject(item.data)) ? 'check_disabled' : ((key == 'wx_account' && !accountConfigStatus)?'check_disabled':'')) + '">' +
                  '<div class="cursor-pointer form-checkbox-label mr10">' +
                  '<i class="form-checkbox cust—checkbox cursor-pointer mr5 '+ (!$.isEmptyObject(obj) && obj.module && obj.module.indexOf(item.name) > -1?((!item.setup || $.isEmptyObject(item.data)) ?'':((key == 'wx_account' && !accountConfigStatus)?'':'active')):'') +'" data-type="'+ item.name +'"></i>' +
                  '<input type="checkbox" class="form—checkbox-input hide mr10" name="' + item.name + '" '+ ((item.setup || !$.isEmptyObject(item.data))?((key == 'wx_account' && !accountConfigStatus)?'':'checked'):'') +'/>' +
                  '<span class="vertical_middle" title="' + item.ps + '">' + item.title + ((!item.setup || $.isEmptyObject(item.data)) ? '[<a target="_blank" class="bterror installNotice" data-type="'+ item.name +'">未配置</a>]' : ((key == 'wx_account' && !accountConfigStatus)?'[<a target="_blank" class="bterror installNotice" data-type="'+ item.name +'">未配置</a>]':'')) + '</span>' +
                  '</div>' +
                  '</div>';
            if ((!item.setup || $.isEmptyObject(item.data))) {
                unInstall += _html;
              }else{
                html += _html;
              }
            }
            $('.installPush').html(html + unInstall)
            if(!$('.installPush .active').length && html != '') {
              $('.installPush .module-check:eq(0) input').prop('checked',true).prev().addClass('active')
            }
          }
        }
        // 安装消息通道
        $('.installPush').on('click', '.form-checkbox-label', function () {
          var that = $(this).find('i')
          if (!that.parent().parent().hasClass('check_disabled')){
            if (that.hasClass('active')) {
              that.removeClass('active')
              that.next().prop('checked', false)
            } else {
              that.addClass('active')
              that.next().prop('checked', true)
            }
          }
        });

        $('.installPush').on('click','.installNotice',function(){
          var type = $(this).data('type')
          openAlertModuleInstallView(type)
        })
      },
      yes: function (index) {
        var arry = [];
        $('.installPush .active').each(function(item){
          var item = $(this).attr('data-type')
          arry.push(item)
        })
        if(!arry.length) return layer.msg('请选择至少一种告警通知方式',{icon:2})
        var data = {
          type: obj.type,
          cycle: 5,
          count: parseInt($('input[name="count"]').val()),
          push_count: parseInt($('input[name="push_count"]').val()),
          module: arry.join(','),
          project: obj['project'] ? obj.project : '',
        }
        if(obj.type === 'disk'){
          data['interval'] = 600
          data.cycle = parseInt($('input[name="cycle"]:checked').val())
        }
        if(data.count === '' || data.count <= 0 || (data.count > 100 && obj.type === 'disk' && data.cycle == 2)) return layer.msg(data.cycle == 1 ? '剩余容量范围不正确' : '百分比范围不正确',{icon:2});
        if(data.push_count === '' || data.push_count <= -1) return layer.msg('发送次数不能小于0',{icon:2});
        _this.set_push_config({data: data},function (res) {
          if(res.status) layer.close(index)
        })
      },
      btn2: function (index) {
        $('#'+ obj.type +'Tips').prop('checked', !$('#'+ obj.type +'Tips').is(':checked'))
      }
    })
  },
  //获取对应告警信息
  get_alarm_data:function (type, project){
    var _this = this
    var data = {}
    if($.isEmptyObject(_this.cache_system_push)) return data
    for (var key in _this.cache_system_push) {
      var item = _this.cache_system_push[key]
      if(project ? (item.type === type && item.project === project) : item.type === type){
        data = item
        if(!data['id']) data['id'] = key
      }
    }
    return data
  },
  //添加和编辑告警信息
  set_push_config:function (obj, callback) {
    var _this = this
    bt_tools.send({
      url: '/push?action=set_push_config',
      data: {
        id: obj['id'] ? obj.id : parseInt(new Date().getTime()/1000),
        name: 'system_push',
        data: JSON.stringify(obj.data)
      }
    },function (res) {
      bt_tools.msg(res)
      _this.get_push_list()
      if(callback) callback(res)
    })
  },
  //切换告警状态
  set_push_status:function (id, status) {
    var _this = this
    bt_tools.send({
      url: '/push?action=set_push_status',
      data: {
        name: 'system_push',
        id: id,
        status: status
      }
    },function (res) {
      bt_tools.msg(res)
      _this.get_push_list()
    })
  },
  //获取告警列表
  get_push_list: function () {
    var _this = this
    var arr = ['cpu','mem','load','disk']
    bt_tools.send({
      url: '/push?action=get_push_list',
    },function (res) {
      _this.cache_system_push = res.system_push
      for (var key in _this.cache_system_push) {
        var item = _this.cache_system_push[key],
            title = (item.type == 'load' ? '平均负载' : item.type == 'cpu' ? '平均CPU' : item.type == 'mem' ? '内存使用率' : '磁盘')
        if(arr.indexOf(item.type) !== -1){
          var str = ''
          if(item.type === arr[3]) {
            str = '该'+ title + (item.cycle == 1 ? '余量不足' + item.count + 'G' : '用量超过'+ item.count +'%触发')
            $('.disk_scanning_btn[data-path="'+ item.project +'"]').parents('.disk_cont').find('.disk_alarm_tips').html(str)
          }else{
            str = item.cycle +'分钟内'+ title +'超过'+ item.count +'%触发'
            $('.'+ item.type +'_alarm_tips').html(str)
          }
        }
      }
    })
  },
  get_server_info: function (info) {
    // bt.system.get_total(function (info){
    var memFree = info.memTotal - info.memRealUsed;
    if (memFree < 64) {
      $("#messageError").show();
      $("#messageError").append('<p><span class="glyphicon glyphicon-alert" style="color: #ff4040; margin-right: 10px;">' + lan.index.mem_warning + '</span> </p>')
    }

    if (info.isuser > 0) {
      $("#messageError").show();
      $("#messageError").append('<p><span class="glyphicon glyphicon-alert" style="color: #ff4040; margin-right: 10px;"></span>' + lan.index.user_warning + '<span class="c7 mr5" title="此安全问题不可忽略，请尽快处理" style="cursor:no-drop"> [不可忽略]</span><a class="btlink" href="javascript:setUserName();"> [立即修改]</a></p>')
    }

    if (info.isport === true) {
      $("#messageError").show();
      $("#messageError").append('<p><span class="glyphicon glyphicon-alert" style="color: #ff4040; margin-right: 10px;"></span>当前面板使用的是默认端口[8888]，有安全隐患，请到面板设置中修改面板端口!<span class="c7 mr5" title="此安全问题不可忽略，请尽快处理" style="cursor:no-drop"> [不可忽略]</span><a class="btlink" href="/config"> [立即修改]</a></p>')
    }
    var _system = info.system;
    $("#info").html(_system);
    $("#running").html(info.time);
    if (_system.indexOf("Windows") != -1) {
      $(".ico-system").addClass("ico-windows");
    }
    else if (_system.indexOf("CentOS") != -1) {
      $(".ico-system").addClass("ico-centos");
    }
    else if (_system.indexOf("Ubuntu") != -1) {
      $(".ico-system").addClass("ico-ubuntu");
    }
    else if (_system.indexOf("Debian") != -1) {
      $(".ico-system").addClass("ico-debian");
    }
    else if (_system.indexOf("Fedora") != -1) {
      $(".ico-system").addClass("ico-fedora");
    }
    else {
      $(".ico-system").addClass("ico-linux");
    }
    // })
  },

  /**
   * @description 渲染系统信息
   * @param rdata 接口返回值
   *
   */
  reander_system_info: function (callback) {
    var _this = this;
    var start_time = new Date().getTime();
    bt.system.get_net(function (res) {
      _this.chart_result = res
      // 动态添加磁盘，并赋值disk_view
      if (_this.chart_view.disk == undefined) {
        for (var i = 0; i < res.disk.length; i++) {
          var diskHtml = "<li class='rank col-xs-6 col-sm-3 col-md-3 col-lg-2 mtb20 circle-box text-center'><div id='diskName" + i + "' class='diskName'></div><div class='chart-li' id='diskChart" + i + "'></div><div id='disk" + i + "'></div></li>";
          $("#systemInfoList").append(diskHtml);
          _this.disk_view.push(echarts.init(document.querySelector("#diskChart" + i)));
        }
      }

      // 负载
      var loadCount = Math.round((res.load.one / res.load.max) * 100) > 100 ? 100 : Math.round((res.load.one / res.load.max) * 100);
      loadCount = loadCount < 0 ? 0 : loadCount;
      var loadInfo = _this.chart_color_active(loadCount);
      //实时刷新负载弹窗数据
      $('.load_text').text('运行达到' + loadCount + '%').removeClass('color-red-box color-org-box color-green-box').addClass(loadCount >= 80 ? loadCount >= 90 ? 'color-red-box' : 'color-org-box' : 'color-green-box')

      // cpu
      var cpuCount = res.cpu[0];
      var cpuInfo = _this.chart_color_active(cpuCount);
      //实时刷新cpu弹窗数据
      $('.cpu_text').text('占用' + cpuCount+'%').removeClass('color-red-box color-org-box color-green-box').addClass(cpuCount >= 80 ? cpuCount >= 90 ? 'color-red-box' : 'color-org-box' : 'color-green-box')
      for (var i = 0; i < res.cpu[2].length; i++) {
        $('#cpu_'+ (i+1) +'_num').text(res.cpu[2][i] + '%' + (res.cpu[2].hasOwnProperty(i+1) ? ' / ' + res.cpu[2][i+1] + '%' : ''))
        i++
      }

      // 内存
      var memCount = Math.round((res.mem.memRealUsed / res.mem.memTotal) * 1000) / 10; // 返回 memRealUsed 占 memTotal 的百分比
      var memInfo = _this.chart_color_active(memCount);
      bt.set_cookie('memSize', res.mem.memTotal)
      //实时刷新内存弹窗数据
      $('.mem_text').text('占用' + memCount + '%').removeClass('color-red-box color-org-box color-green-box').addClass(memCount >= 80 ? memCount >= 90 ? 'color-red-box' : 'color-org-box' : 'color-green-box')
      $('#mem_Free').text(res.mem.memFree+ 'MB')
      $('#mem_buffer_cache').text((res.mem.memBuffers + res.mem.memCached) + 'MB')

      // 磁盘
      var diskList = res.disk;
      var diskJson = [];
      for (var i = 0; i < diskList.length; i++) {
        var ratio = diskList[i].size[3];
        ratio = parseFloat(ratio.substring(0, ratio.lastIndexOf("%")));
        var diskInfo = _this.chart_color_active(ratio)

        diskJson.push(diskInfo)

      }

      // chart_json存储最新数据
      _this.chart_json['load'] = loadInfo;
      _this.chart_json['cpu'] = cpuInfo;
      _this.chart_json['mem'] = memInfo;
      _this.chart_json['disk'] = diskJson
      // 初始化 || 刷新
      if (_this.chart_view.disk == undefined) {
        _this.init_chart_view()
      } else {
        _this.set_chart_data()
      }
      $('.rank .titles').show()

      var net_key = bt.get_cookie('network_io_key');
      if (net_key) {
        res.up = res.network[net_key].up;
        res.down = res.network[net_key].down;
        res.downTotal = res.network[net_key].downTotal;
        res.upTotal = res.network[net_key].upTotal;
        res.downPackets = res.network[net_key].downPackets;
        res.upPackets = res.network[net_key].upPackets;
        res.downAll = res.network[net_key].downTotal;
        res.upAll = res.network[net_key].upTotal;
      }
      var net_option = '<option value="all">全部</option>';
      $.each(res.network, function (k, v) {
        var act = (k == net_key) ? 'selected' : '';
        net_option += '<option value="' + k + '" ' + act + '>' + k + '</option>';
      });

      $('select[name="network-io"]').html(net_option);


      //刷新流量
      $("#upSpeed").html(res.up.toFixed(2) + ' KB');
      $("#downSpeed").html(res.down.toFixed(2) + ' KB');
      $("#downAll").html(bt.format_size(res.downTotal));
      $("#upAll").html(bt.format_size(res.upTotal));
      index.net.add(res.up, res.down);


      var disk_key = bt.get_cookie('disk_io_key') || 'ALL', disk_io_data = res.iostat[disk_key || 'ALL'], mb = 1048576, ioTime = disk_io_data.write_time > disk_io_data.read_time ? disk_io_data.write_time : disk_io_data.read_time
      $('#readBytes').html(bt.format_size(disk_io_data.read_bytes))
      $('#writeBytes').html(bt.format_size(disk_io_data.write_bytes))
      $('#diskIops').html((disk_io_data.read_count + disk_io_data.write_count) + ' 次')
      $('#diskTime').html(ioTime + ' ms').css({ 'color': ioTime > 100 && ioTime < 1000 ? '#ff9900' : ioTime >= 1000 ? 'red' : '#20a53a' })

      index.iostat.add((disk_io_data.read_bytes / mb).toFixed(2), (disk_io_data.write_bytes / mb).toFixed(2), disk_io_data);


      var disk_option = '';
      $.each(res.iostat, function (k, v) {
        disk_option += '<option value="' + k + '" ' + (k == disk_key ? 'selected' : '') + '>' + (k == 'ALL' ? '全部' : k) + '</option>';
      });
      $('select[name="disk-io"]').html(disk_option);

      if (index.net.table) index.net.table.setOption({ xAxis: { data: index.net.data.aData }, series: [{ name: lan.index.net_up, data: index.net.data.uData }, { name: lan.index.net_down, data: index.net.data.dData }] });
      if (index.iostat.table) index.iostat.table.setOption({ xAxis: { data: index.iostat.data.aData }, series: [{ name: '读取字节数', data: index.iostat.data.uData }, { name: '写入字节数', data: index.iostat.data.dData }] });
      //请求成功后，重新调用该方法
      if(res) {
        var end_time = new Date().getTime();
        var timeout = end_time - start_time
        setTimeout(function () {
          _this.reander_system_info()
        },timeout > 3000 ? timeout : 3000)
      }
      if (callback) callback(res)
    });
  },
  /**
   * @description 渲染画布视图
   *
   */
  init_chart_view: function () {
    // 所有图表对象装进chart_view
    this.chart_view['load'] = echarts.init(document.querySelector("#loadChart"))
    this.chart_view['cpu'] = echarts.init(document.querySelector("#cpuChart"))
    this.chart_view['mem'] = echarts.init(document.querySelector("#memChart"))
    this.chart_view['disk'] = this.disk_view

    // 图表配置项
    this.series_option = {
      series: [{
        type: 'gauge',
        startAngle: 90,
        endAngle: -270,
        animationDuration: 1500,
        animationDurationUpdate: 1000,
        radius: '99%',
        pointer: {
          show: false
        },
        progress: {
          show: true,
          overlap: false,
          roundCap: true,
          clip: false,
          itemStyle: {
            borderWidth: 1,
            borderColor: '#20a53a'
          }
        },
        axisLine: {
          lineStyle: {
            width: 7,
            color: [[0, "rgba(204,204,204,0.5)"], [1, "rgba(204,204,204,0.5)"]]
          }
        },
        splitLine: {
          show: false,
          distance: 0,
          length: 10
        },
        axisTick: {
          show: false
        },
        axisLabel: {
          show: false,
          distance: 50
        },
        data: [{
          value: 0,
          detail: {
            offsetCenter: ['0%', '0%']
          },
          itemStyle: {
            color: '#20a53a',
            borderColor: '#20a53a'
          },
        }],
        detail: {
          width: 50,
          height: 15,
          lineHeight: 15,
          fontSize: 17,
          color: '#20a53a',
          formatter: '{value}%',
          fontWeight: 'normal'
        }
      }]
    };
    this.set_chart_data()
  },
  /**
   * @description 赋值chart的数据
   *
   */
  set_chart_data: function () {
    this.chart_active("load")
    this.chart_active("cpu")
    if (!this.release) {
      this.chart_active("mem")
    }
    for (var i = 0; i < this.chart_view.disk.length; i++) {
      this.series_option.series[0].data[0].value = this.chart_json.disk[i].val
      this.series_option.series[0].data[0].itemStyle.color = this.chart_json.disk[i].color
      this.series_option.series[0].data[0].itemStyle.borderColor = this.chart_json.disk[i].color
      this.series_option.series[0].progress.itemStyle.borderColor = this.chart_json.disk[i].color
      this.series_option.series[0].detail.color = this.chart_json.disk[i].color
      this.chart_view.disk[i].setOption(this.series_option, true)
      $("#disk" + i).text(this.chart_result.disk[i].size[1] + " / " + this.chart_result.disk[i].size[0])
      $("#diskName" + i).text(this.chart_result.disk[i].path).attr('title', this.chart_result.disk[i].path)
    }
  },
  /**
   * @description 赋值chart的数据
   *
   */
  chart_active: function (name) {
    // 图表数据
    this.series_option.series[0].data[0].value = this.chart_json[name].val
    this.series_option.series[0].data[0].itemStyle.color = this.chart_json[name].color
    this.series_option.series[0].data[0].itemStyle.borderColor = this.chart_json[name].color
    this.series_option.series[0].progress.itemStyle.borderColor = this.chart_json[name].color
    this.series_option.series[0].detail.color = this.chart_json[name].color

    this.chart_view[name].setOption(this.series_option, true)

    // 文字
    var val = ""
    switch (name) {
      case 'load':
        val = this.chart_json[name].title
        break;
      case 'cpu':
        val = this.chart_result.cpu[1] + ' 核心'
        break;
      case 'mem':
        val = this.chart_result.mem.memRealUsed + " / " + this.chart_result.mem.memTotal + "(MB)"
        break;
    }

    $("#" + name).text(val)
  },
  /**
   * @description 赋值chart的颜色
   *
   */
  chart_color_active: function (number) {
    var activeInfo = {};
    for (var i = 0; i < this.load_config.length; i++) {
      if (number >= this.load_config[i].val) {
        activeInfo = JSON.parse(JSON.stringify(this.load_config[i]));
        break;
      } else if (number <= 30) {
        activeInfo = JSON.parse(JSON.stringify(this.load_config[3]));
        break;
      }
    }
    activeInfo.val = number;
    return activeInfo;
  },




  get_index_list: function () {
    bt.soft.get_index_list(function (rdata) {
      var con = '';
      var icon = '';
      var rlen = rdata.length;
      var clickName = '';
      var setup_length = 0;
      var softboxsum = 12;
      var softboxcon = '';
      for (var i = 0; i < rlen; i++) {
        if (rdata[i].setup) {
          setup_length++;
          if (rdata[i].admin) {
            clickName = ' onclick="bt.soft.set_lib_config(\'' + rdata[i].name + '\',\'' + rdata[i].title + '\')"';
          }
          else {
            clickName = 'onclick="soft.set_soft_config(\'' + rdata[i].name + '\')"';
          }
          var icon = rdata[i].name;
          if (bt.contains(rdata[i].name, 'php-')) {
            icon = 'php';
            rdata[i].version = '';
          }
          var status = '';
          if (rdata[i].status) {
            status = '<span style="color:#20a53a" class="glyphicon glyphicon-play"></span>';
          } else {
            status = '<span style="color:red" class="glyphicon glyphicon-pause"></span>'
          }
          con += '<div class="col-sm-3 col-md-3 col-lg-3" data-id="' + rdata[i].name + '">\
							<span class="spanmove"></span>\
							<div '+ clickName + '>\
							<div class="image"><img width="48" src="/static/img/soft_ico/ico-'+ icon + '.png"></div>\
							<div class="sname">'+ rdata[i].title + ' ' + rdata[i].version + status + '</div>\
							</div>\
						</div>'
        }
      }
      $("#indexsoft").html(con);

      // 推荐安装软件
      try {
        var recomConfig = product_recommend.get_recommend_type(1)
        if(recomConfig){
          var pay_status = product_recommend.get_pay_status();
          for (var i = 0; i < recomConfig['list'].length; i++) {
            var item = recomConfig['list'][i];
            if(setup_length > softboxsum) break;
            if(pay_status.is_pay && item['install']) continue;
            var day_not_display = bt.get_storage('home_day_not_display_'+ item['name']);
            if(day_not_display && parseInt(day_not_display) > new Date().getTime()) continue;
            softboxcon += '<div class="col-sm-3 col-md-3 col-lg-3">\
              <div class="recommend-soft recom-iconfont" data-name="'+ item['name'] +'">\
                <div class="day-not-display">近24小时不再显示<span></span></div>\
                <div class="product-close hide">关闭推荐</div>\
                <div class="images"><img src="/static/img/soft_ico/ico-'+ item['name'] +'.png"></div>\
                <div class="product-name">'+ item['title'] +'</div>\
                <div class="product-pay-btn">\
                '+ ((item['isBuy'] && !item['install'])?
                '<button class="btn btn-sm btn-success home_recommend_btn recommend_install" style="margin-left:0;" data-name="'+ item['name'] +'">立即安装</button>':
                '<a class="btn btn-sm btn-default mr5 '+ (!item.preview?'hide':'') +'" href="'+ item.preview +'" target="_blank">预览</a><button type="submit" data-index="'+i+'" data-pay="'+item.pay+'" data-pluginType="'+item.pluginType+'" class="btn btn-sm btn-success home_recommend_btn pay_recommend_plungin">购买</button>') +'\
                </div>\
              </div>\
            </div>'
            setup_length ++;
            //  onclick=\"product_recommend.pay_product_sign(\'ltd\','+ item.pay +',\''+item.pluginType+'\')\"
          }
        }
      } catch (error) {
        console.log(error)
      }
      //软件位置移动
      if (setup_length <= softboxsum) {
        for (var i = 0; i < softboxsum - setup_length; i++) {
          softboxcon += '<div class="col-sm-3 col-md-3 col-lg-3 no-bg"></div>'
        }
      }
      $("#indexsoft").append(softboxcon);
      //交互优化------非企业版用户 首页软件推荐增加近3天不再显示
      if(bt.get_cookie('ltd_end') < 0) {
        $('.recommend-soft.recom-iconfont').hover(function(){
          var name = $(this).data('name')
          $(this).find('.day-not-display').fadeIn("1000").find('span').click(function(e){
            bt.set_storage('home_day_not_display_' + name, (new Date().getTime() + 86400*1000))  //3天不再显示
            $(this).parent().parent().parent().addClass('no-bg')
            $(this).parent().parent().remove()
          })
        },function() {
          $(this).find('.day-not-display').hide()
        })
      }
      //交互优化------非企业版用户 首页软件推荐增加近3天不再显示end
      $('.pay_recommend_plungin').unbind('click').click(function(){
          var item_pay = $(this).data('pay'),item_pluginType = $(this).data('pluginType'),index = $(this).data('index')
        //   console.log(product_recommend.get_recommend_type(1)['list'][index])
          if(bt.get_cookie('ltd_end')<0){
              // var pro_item = product_recommend.get_recommend_type(1)['list'][index]
              // pro_item.pluginName = pro_item.title
              // pro_item.imgSrc = 'https://www.bt.cn/Public/new/plugin/'+pro_item.name+'/1.png'
              // product_recommend.recommend_product_view(pro_item, {
              //   imgArea: ['800px', '576px']
              // },'ltd',item_pay,item_pluginType)
              product_recommend.pay_product_sign('ltd', item_pay, 'ltd')
          }

      })
      $("#indexsoft").dragsort({ dragSelector: ".spanmove", dragBetween: true, dragEnd: saveOrder, placeHolderTemplate: "<div class='col-sm-3 col-md-3 col-lg-3 dashed-border'></div>" });

      $('.recommend_install').unbind('click').click(function () {
        var name = $(this).data('name');
        bt.soft.install(name)
        soft_setup_find()
        function soft_setup_find() {
          $.post("plugin?action=get_soft_find", {
            sName: name
          }, function (rdata) {
            if (!rdata.setup) {
              setTimeout(function () {
                soft_setup_find();
              }, 3000);
            } else {
              bt.send('add_index', 'plugin/add_index', {
                sName: name
              }, function (rdata) {
                rdata.time = 1000;
                product_recommend.init(function(){
                  index.get_product_status(function(){
                    index.recommend_paid_version()
                  });
                  index.get_index_list();
                })
              })
            }
          });
        }
      })
      function saveOrder () {
        var data = $("#indexsoft > div").map(function () { return $(this).attr("data-id"); }).get();
        data = data.join('|');
        bt.soft.set_sort_index(data)
      };
    })
  },
  check_update: function (state) {
    if ($('.layui-layer-dialog').length > 0) return false;
    var loadT = bt.load();
    bt.system.check_update(function (rdata) {
      loadT.close();
      if (rdata.status === false && typeof rdata.msg === 'string') {
				try {
					messagebox()
				} catch (err) {}
				layer.msg(rdata.msg, { icon: 2 });
				return
			}
      var data = rdata.msg
			var is_beta = data.is_beta
			var beta = data.beta
			var versionData = is_beta ? beta : data
			var versionType = is_beta ? '测试版' : '正式版'
			var content = ''
			var isNpsShow = true
      if(rdata.status){
        content = '<div class="update-title">版本更新-' + bt.os + '面板' + versionType + '</div>\
        <img class="update_bg" src="static/img/update_1.png" alt="" />' +
        '<div class="setchmod bt-form" >\
          <div class="update_title">\
            <div class="sup_title">'+ '发现新的面板版本，是否立即更新？' +'</div>\
            <div class="sub_title">'+ '最新版本：' + '<a href="https://www.bt.cn/bbs/forum-36-1.html" target="_blank" class="btlink" title="查看版本更新日志">宝塔'+ bt.os + versionType +' '+ versionData.version + '</a>'+ (!rdata.status ? '&nbsp;&nbsp;发布时间：' + versionData.uptime : '') +'</div>\
          </div>\
          <div class="update_conter">' +
            (rdata.status ? '<div class="update_logs">'+versionData.updateMsg+'</div><hr>' : '') +
            '<div class="update_tips">'+ (is_beta?'正式版':'测试版') + '最新版本为：&nbsp;' + (is_beta?data.version:beta.version) + '&nbsp;&nbsp;&nbsp;更新时间：&nbsp;' + (is_beta?data.uptime:beta.uptime) + '&nbsp;&nbsp;&nbsp;\
            '+ (!is_beta ? '<span>如需更新测试版请点击<a href="javascript:;" onclick="index.beta_msg()" class="btlink btn_update_testPanel">查看详情</a></span>' : '<span>如需切换回正式版请点击<a href="javascript:;" onclick="index.to_not_beta()" class="btlink btn_update_testPanel">切换到正式版</a></span>') + '\
            '+ (is_beta ? data.btb : '') + '\
            <span>有更新时提醒我：<span class="bt_switch" style="display:inline-block"><input class="btswitch btswitch-ios" id="updateTips" type="checkbox"><label class="btswitch-btn" for="updateTips"></label></span><a class="btlink setupdateconfig" style="margin-left: 15px;" href="javascript:;">提醒方式</a></span></span>\
            </div>\
          </div>\
          <div class="bt-form-btn '+ (!rdata.status?'hide':'') +'">\
            <button type="button" class="btn ignore-renew">忽略本次更新</button>\
            <button type="button" class="btn btn-success btn_update_panel" onclick="index.to_update()" >'+ lan.index.update_go + '</button>\
          </div>\
        </div>'
      }else{
        content = '\
				<div class="update_back"><img src="/static/img/update_back.png"></div>\
        <div class="setchmod bt-form">\
          <div class="update_title">\
            <img src="/static/img/update-icon.png"/>\
            <span>当前已经是最新版本</span>\
          </div>\
          <div class="update_version"><span>当前版本：<a href="https://www.bt.cn/bbs/forum-36-1.html" target="_blank" class="btlink" title="查看当前版本日志">' + bt.os + (is_beta?'测试版':'正式版')+'&nbsp;&nbsp;' + versionData.version + '</a></span><span style="margin-left:25px">发布时间：' + versionData.uptime + '</span></div>'+
            '\
              <div class="update_conter">\
                  <div class="update_tips"><div class="tip_version"><span class="mr10">最新'+ (is_beta?'正式版':'测试版') + '：' + (is_beta?'正式版&nbsp;'+data.version:'测试版&nbsp;'+beta.version) + '</span><span class="ml10">更新时间：' + (is_beta?data.uptime.replaceAll('/','-'):beta.uptime.replaceAll('/','-')) + '</span></div>\
                  '+ (!is_beta ? '<span style="margin-top:8px;">如需更新测试版请点击<a href="javascript:;" onclick="index.beta_msg()" class="btlink btn_update_testPanel">查看详情</a></span>' : '<span>如需切换回正式版请点击<a href="javascript:;" onclick="index.to_not_beta()" class="btlink btn_update_testPanel">切换到正式版</a></span>') + '\
                  '+ (is_beta ? '<span style="margin-top:8px;">每次升级测试版都会随机获得10-50个宝塔币奖励，可以进行<a href="https://www.bt.cn/bbs/thread-21014-1-1.html" rel="noreferrer noopener" target="_blank" class="btlink">礼品兑换</a></span>' : '') + '\
                  <span>有更新时提醒我：<span class="bt_switch" style="display:inline-block"><input class="btswitch btswitch-ios" id="updateTips" type="checkbox"><label class="btswitch-btn" for="updateTips"></label></span><a class="btlink setupdateconfig" style="margin-left: 15px;" href="javascript:;">提醒方式</a></span></span>\
                  </div>\
              </div>\
							<div id="feedback">\
								<div class="npsBanner" style="text-align:center;">\
								<span class="showNps" style="color:#20a53a;vertical-align:4px; font-size:12px;cursor:pointer;">点击此处折叠需求反馈<span class="glyphicon glyphicon-triangle-bottom ml5" style="display:'+ (isNpsShow? 'none':'inline') +';"></span><span class="glyphicon glyphicon-triangle-top ml5" style="display:'+ (isNpsShow? 'inline':'none') +';"></span></span>\
							</div>\
							<div class="NPSForm" style=" display:'+ (isNpsShow? 'block':'none') +';">\
								<div class="flex flex-col items-center">\
									<div id="feedForm" style="padding-left:31px;"></div>\
								</div>\
							</div>\
							</div>\
          </div>\
          <style>\
            .update_title{display:flex;justify-content:center;align-items:center;position: relative;vertical-align: middle;margin: 12px 0;}\
            .update_title img{width:32px;margin-top: 4px;margin-right: 8px;}\
            .layui-layer-title{border:none;}\
            .update_title .layui-layer-ico{display: block;left: 40px !important;top: 1px !important;}\
            .update_back{background:linear-gradient(to top,rgb(255 255 255),#37BC51);position:absolute;width:100%;height:100px;z-index:-1;}\
            .update_back img{position:absolute;top:0;width:100%}\
            .update_title span{font-weight: 700;display: inline-block;color: #555;line-height: 32px;font-size: 24px;}\
            .update_conter{background: rgb(247, 252, 248);border-radius: 4px;padding: 24px 16px;margin:20px 32px 32px;margin-top: 16px;border: 1px solid #efefef;}\
            .update_version{font-size: 13px;text-align:center;font-weight:500;margin:0 36px 0;display:flex;justify-content:space-between;}\
            .update_version span{display:inline-block !important;text-align:left;}\
            .update_logs{font-size: 12px;color:#555;max-height:200px;overflow:auto;}\
            .update_tips{font-size: 12px;color:rgb(51, 51, 51);font-weight:400;}\
            .update_tips>span{font-size: 12px;color:rgb(51, 51, 51);font-weight:400;margin-top:0;}\
            .update_conter span{display: block;font-size:12px;color:#666}\
            .bt-form-btn {text-align: center;padding: 10px 0;}\
            .bt-form-btn .btn:nth-child(1):hover {background: #d4d4d4}\
            .bt-form-btn .btn {display: inline-block;line-height: 38px;height: 40px;border-radius: 20px;width: 140px;padding:0;margin-right: 30px;font-size:13.5px;}\
            .bt-form-btn .btn:nth-child(2) {margin-right: 0;}\
            .setchmod{height:auto;background-color:white;margin-top:32px;background:linear-gradient(to top,rgb(255 255 255),rgb(255 255 255),rgb(255 255 255),rgb(255 255 255),rgba(255,255,255,0));display:flex;justify-content:center;flex-direction:column;border-radius: 4px;}\
            .setchmod.bt-form .btswitch-btn {margin-bottom: 0;height: 1.9rem;width: 3.2rem;position: relative;top: 4.5px;}\
            .tip_version{width:100%;display:flex;flex-direction:row;}\
        </style>'
      }
			bt.open({
        type: 1,
        title: rdata.status ? false : ['宝塔'+ bt.os + '面板','background-color:#37BC51;color:white;height:36px;padding:0 80px 0 13.5px;'],
        area: '550px',
        shadeClose: false,
        skin: 'layui-layer-dialog'+(!rdata.status ? '' : ' new-layer-update active'),
        closeBtn: 2,
        content: content,
        success:function (layers,indexs) {

          if(!rdata.status){
						$(layers).find('.layui-layer-content').css('padding','0')
						$('.showNps').off('click').on('click',function(){
							isNpsShow = !isNpsShow
							if(isNpsShow){
								$('.NPSForm').show()
								$('.glyphicon-triangle-bottom').hide()
								$('.glyphicon-triangle-top').show()
							}else{
								$('.NPSForm').hide()
								$('.glyphicon-triangle-bottom').show()
								$('.glyphicon-triangle-top').hide()
							}
						})
						bt_tools.form({
							el:'#feedForm',
							form:[
								{
									group: {
										type: 'textarea',
										name: 'feed',
										style: {
											'width': '481px',
											'min-width': '486px',
											'min-height': '80px',
											'line-height': '22px',
											'padding-top': '10px',
											'resize': 'none'
										},
										tips: { //使用hover的方式显示提示
											text: '您当前已经是最新版本，如果您使用过程有无法满足的需求，请反馈给我们，我们将尽力为您解决或完善。',
											style: { top: '336px', left: '39px',width:'486px', padding: '0 8px 0px 3px','font-size':'12px'},
										},
									}
								},
                {
                  label:'<span style="color:#666">是否愿意接受回访：</span>',
                  group:{
                    type: 'other',
                    boxcontent:'\
							<div style="padding-top: 2px;margin-left: -10px;">\
								<input class="btswitch btswitch-ios" id="feedback-status" type="checkbox">\
								<label style="margin-left:6px;margin-right:6px;height: 17px;width: 28px;" class="btswitch-btn phpmyadmin-btn" for="feedback-status" ></label>\
							</div>'
                  }
                },
                {
                  group: {
                    type: 'text',
                    name: 'feedbackPhone',
                    width: '500px',
                    placeholder: '请留下手机号码或邮箱，以便我们联系您',
                    value: '',
                  }
                },
								{
									group:{
										name: 'tips',
										type: 'other',
										boxcontent:'<div style="color:#20a53a;font-size:12px;position: relative;top: -12px;margin-left:39px;">我们特别重视您的需求反馈，我们会定期每周进行需求评审。希望能更好的帮到您</div>'
									}
								},
								{
									group: {
										type: 'button',
										size: '',
										name: 'submitForm',
										class:'feedBtn',
										style:'margin:-10px auto 20px;padding:6px 40px;position: relative;top: -12px;',
										title: '提交',
										event: function (formData, element, that) {
                      // 触发submit
                      if(formData.feed == '') {
                        return bt.msg({status:false,msg:'请填写反馈内容~'})
                      }
                      if($('#feedback-status').prop('checked')){
                        if (!/^1[3456789]\d{9}$/.test(formData.feedbackPhone) && !/^(\w-*\.*)+@(\w-?)+(\.\w{2,})+$/.test(formData.feedbackPhone)) {
                          return bt.msg({status: false, msg: '请填写正确的手机号码或邮箱~'})
                        }
                      }

                      function checkString(str) {
                        const phoneRegex = /^1[3456789]\d{9}$/
                        const emailRegex = /^(\w-*\.*)+@(\w-?)+(\.\w{2,})+$/

                        if (phoneRegex.test(str)) {
                          return 'phone'
                        } else if (emailRegex.test(str)) {
                          return 'email'
                        } else {
                          return 'unknown'
                        }
                      }
                      var type = checkString(formData.feedbackPhone)
											var config = {}
											config['22'] = formData.feed
                      bt_tools.send({url:'config?action=write_nps_new',
                        data:type=='unknown'? {questions:JSON.stringify(config),software_name:1,rate:0,product_type:18}:{questions:JSON.stringify(config),software_name:1,rate:0,product_type:18,feedback: JSON.stringify(
                            type === 'phone' ? { phone: formData.feedbackPhone } : { email: formData.feedbackPhone }
                          )}},function(ress){
												if(ress.status){
													layer.close(indexs)
													layer.open({
														title: false,
														btn: false,
														shadeClose: true,
														shade:0.1,
														closeBtn: 0,
														skin:'qa_thank_dialog',
														area: '230px',
														content: '<div class="qa_thank_box" style="background-color:#F1F9F3;text-align: center;padding: 20px 0;"><img src="/static/img/feedback/QA_like.png" style="width: 55px;"><p style="margin-top: 15px;">感谢您的参与!</p></div>',
														success: function (layero,index) {
															$(layero).find('.layui-layer-content').css({'padding': '0','border-radius': '5px'})
															$(layero).css({'border-radius': '5px','min-width': '230px'})

															setTimeout(function(){layer.close(index)},3000)
														}
													})
												}
											},'提交反馈')

										}
									}
								}
							]
						})
            $('.tname').css({'width': '130px','padding':'0','text-align':'left'})
            $('.bt-form').find('input[name="feedbackPhone"]').parent('.inlineBlock ').hide()
            if($('#feedback-status').length > 0){
              $('#feedback-status').click(function() {
                $('.bt-form').find('input[name="feedbackPhone"]').parent('.inlineBlock ').toggle()
              })
            }
					}
          $('.ignore-renew').on('click',function () {
            bt.send('ignore_version', 'ajax/ignore_version', { version: versionData.version }, function (rdata) {
              bt.msg(rdata);
              if(rdata.status) layer.close(indexs);
            })
          })
          var updateModule = '',_updateStatus = false
          // 更新提醒开关状态
          cacheModule(function (rdata1) {
            updateModule = rdata1.module   //已选择的告警方式
            $('#updateTips').attr('checked',rdata1.status)
          })
          // 设置告警通知
          $('#updateTips').on('click', function () {
            var _that = $(this);
            var isExpiration = $(this).is(':checked');
            var time = new Date().getTime();
            if (isExpiration) {
              alarmMode(_that)
            } else {
              var data = JSON.stringify({
                status: isExpiration,
                type: "panel_update",
                title: "面板更新提醒",
                module: updateModule,
                interval: 600,
                push_count:1
              })
              bt.site.set_push_config({
                name: 'site_push',
                id: 'panel_update',
                data: data,
              }, function (rdata) {
                bt.msg(rdata)
              })
            }
          });
          // 告警方式
          $('.setupdateconfig').on('click',function (){
            alarmMode()
          });
          /**
           * 更新提醒
           * @param $check 更新提醒开关
           */
          function alarmMode ($check) {
            cacheModule(function (rdata1) {
              var time = new Date().getTime();
              var isExpiration = rdata1.status;
              if ($check) isExpiration = $check.is(':checked');
              layer.open({
                type: 1,
                title: '面板更新提醒',
                area: '470px',
                closeBtn: 2,
                content: '\
                    <div class="pd15">\
                      <div class="bt-form plr15">\
                        <div class="line">\
                          <span class="tname">更新提醒</span>\
                          <div class="info-r line-switch">\
                            <input type="checkbox" id="dueAlarm" class="btswitch btswitch-ios" name="due_alarm" ' + (isExpiration ? 'checked="checked"' : '') + ' />\
                            <label class="btswitch-btn" for="dueAlarm"></label>\
                          </div>\
                        </div>\
                        <div class="line">\
                          <span class="tname">告警方式</span>\
                          <div class="info-r installPush"></div>\
                        </div>\
                        <ul class="help-info-text c7">\
                         <li>点击安装后状态未更新，尝试点击【<a class="btlink handRefresh">手动刷新</a>】</li>\
                        </ul>\
                      </div>\
                    </div>',
                btn: ['保存配置', '取消'],
                success: function ($layer) {
                  renderConfigHTML()
                  // 手动刷新
                  $('.handRefresh').click(function(){
                    renderConfigHTML()
                  })

                  // 获取配置
                  function renderConfigHTML(){
                    bt.site.get_msg_configs(function (rdata) {
                      var html = '', unInstall = ''
                      for (var key in rdata) {
                        var item = rdata[key],_html = '',accountConfigStatus = false;
                        if(key == 'sms') continue;
                        if(key === 'wx_account'){
                          if(!$.isEmptyObject(item.data) && item.data.res.is_subscribe && item.data.res.is_bound){
                            accountConfigStatus = true   //安装微信公众号模块且绑定
                          }
                        }

                        _html = '<div class="inlineBlock module-check ' + ((!item.setup || $.isEmptyObject(item.data)) ? 'check_disabled' : ((key == 'wx_account' && !accountConfigStatus)?'check_disabled':'')) + '">' +
                            '<div class="cursor-pointer form-checkbox-label mr10">' +
                            '<i class="form-checkbox cust—checkbox cursor-pointer mr5 '+ (rdata1.module.indexOf(item.name) > -1?((!item.setup || $.isEmptyObject(item.data)) ?'':((key == 'wx_account' && !accountConfigStatus)?'':'active')):'') +'" data-type="'+ item.name +'"></i>' +
                            '<input type="checkbox" class="form—checkbox-input hide mr10" name="' + item.name + '" '+ ((item.setup || !$.isEmptyObject(item.data))?((key == 'wx_account' && !accountConfigStatus)?'':'checked'):'') +'/>' +
                            '<span class="vertical_middle" title="' + item.ps + '">' + item.title + ((!item.setup || $.isEmptyObject(item.data)) ? '[<a target="_blank" class="bterror installNotice" data-type="'+ item.name +'">点击安装</a>]' : ((key == 'wx_account' && !accountConfigStatus)?'[<a target="_blank" class="bterror installNotice" data-type="'+ item.name +'">未配置</a>]':'')) + '</span>' +
                            '</div>' +
                            '</div>';
                        if(!item.setup){
                          unInstall += _html;
                        }else{
                          html += _html;
                        }
                      }
                      $('.installPush').html(html + unInstall)
                    });
                  }
                  // 安装消息通道
                  $('.installPush').on('click', '.form-checkbox-label', function () {
                    var that = $(this).find('i')
                    if (!that.parent().parent().hasClass('check_disabled')){
                      if (that.hasClass('active')) {
                        that.removeClass('active')
                        that.next().prop('checked', false)
                      } else {
                        that.addClass('active')
                        that.next().prop('checked', true)
                      }
                    }
                  });

                  $('.installPush').on('click','.installNotice',function(){
                    var type = $(this).data('type')
                    openAlertModuleInstallView(type)
                  })
                },
                yes: function (index) {
                  var status = $('input[name="due_alarm"]').is(':checked');
                  var arry = [];
                  $('.installPush .active').each(function(item){
                    var item = $(this).attr('data-type')
                    arry.push(item)
                  })
                  if(!arry.length) return layer.msg('请选择至少一种告警通知方式',{icon:2})

                  // 参数
                  var data = {
                    status: status,
                    type: "panel_update",
                    title: "面板更新提醒",
                    module: arry.join(','),
                  }

                  // 请求设置本站点告警配置
                  bt.site.set_push_config({
                    name: 'site_push',
                    id: 'panel_update',
                    data: JSON.stringify(data),
                  }, function (rdata) {
                    bt.msg(rdata)
                    if(rdata.status){
                      $('#updateTips').prop('checked',data.status)
                      layer.close(index)
                    }
                  })
                },
                cancel: function() {
                  $check && $check.prop('checked', !isExpiration)
                },
                btn2: function(){
                  $check && $check.prop('checked', !isExpiration)
                }
              });
            })
          }
          function cacheModule(callback){
            $.post('/push?action=get_push_config', { id:'panel_update',name:'site_push' }, function (rdata1) {
              if(typeof rdata1.code == 'undefined' && typeof rdata1.msg != 'undefined')return layer.msg(rdata1.msg,{icon:2})
              if(typeof rdata1.code != 'undefined' && rdata1.code == 100) rdata1 = {module:'',status:false}
              if(callback) callback(rdata1);
            });
          }
        },
        cancel:function (){
          if(rdata.status) bt.send('ignore_version', 'ajax/ignore_version', { version: versionData.version })
        }
      })
    })
  },
  to_update: function () {
    layer.closeAll();
    bt.system.to_update(function (rdata) {
      if (rdata.status) {
        bt.msg({ msg: lan.index.update_ok, icon: 1 })
        $("#btversion").html(rdata.version);
        $("#toUpdate").html('');
        bt.system.reload_panel();
        setTimeout(function () { window.location.reload(); }, 3000);
      }
      else {
        bt.msg({ msg: rdata.msg, icon: 5, time: 5000 });
      }
    });
  },
  to_not_beta: function () {
    bt.simple_confirm({title:'切换正式版',msg: '切换当前版本为正式版，切换后您将无法体验到最新的测试功能，是否继续操作？'}, function () {

      bt.send('apple_beta', 'ajax/to_not_beta', {}, function (rdata) {
        if (rdata.status === false) {
          bt.msg(rdata);
          return;
        }
        bt.system.check_update(function (rdata) {
          index.to_update();
        });

      });
    });
  },
  beta_msg: function () {
    bt.send('get_beta_logs', 'ajax/get_beta_logs', {}, function (data) {
      var my_list = '';
      for (var i = 0; i < data.list.length; i++) {
        my_list += '<div class="item_list">\
                                            <span class="index_acive"></span>\
                                            <div class="index_date">'+ bt.format_data(data.list[i].uptime).split(' ')[0] + '</div>\
                                            <div class="index_title">'+ data.list[i].version + '</div>\
                                            <div class="index_conter">'+ data.list[i].upmsg + '</div>\
                                        </div>'
      }
      layer.open({
        type: 1,
        title: '申请Linux测试版',
        area: '650px',
        shadeClose: false,
        skin: 'layui-layer-dialog',
        closeBtn: 2,
        content: '<div class="bt-form pd20" style="padding-bottom:50px;padding-top:0">\
                            <div class="bt-form-conter">\
                                <span style="font-weight: 600;">申请内测须知</span>\
                                <div class="form-body">'+ data.beta_ps + '</div>\
                            </div>\
                            <div class="bt-form-conter">\
                                <span style="font-size:16px;">Linux测试版更新日志</span>\
                                <div class="item_box"  style="height:180px;overflow: auto;">'+ my_list + '</div>\
                            </div>\
                            <div class="bt-form-line"> <label for="notice" style="cursor: pointer;"><input id="notice" disabled="disabled" type="checkbox" style="vertical-align: text-top;margin-right:5px"></input><span style="font-weight:500">我已查看“<b>《申请内测须知》</b>”<i id="update_time"></i></span></label>\</div>\
                            <div class="bt-form-submit-btn">\
                                <button type="button" class="btn btn-danger btn-sm btn-title" onclick="layer.closeAll()">'+ lan.public.cancel + '</button>\
                                <button type="button" class="btn btn-success btn-sm btn-title btn_update_panel_beta disabled" >'+ lan.index.update_go + '</button>\
                            </div>\
                            <style>\
                                .bt-form-conter{padding: 20px 25px;line-height: 29px;background: #f7f7f7;border-radius: 5px;padding-bottom:30px;margin-bottom:20px;}\
                                .bt-form-conter span{margin-bottom: 10px;display: block;font-size: 19px;text-align: center;color: #333;}\
                                .form-body{color: #333;}\
                                #notice span{cursor: pointer;}\
                                #update_time{font-style:normal;color:red;}\
                                .item_list{margin-left:95px;border-left:5px solid #e1e1e1;position:relative;padding:5px 0 0 2px}.index_title{border-bottom:1px solid #ececec;margin-bottom:5px;font-size:15px;color:#20a53a;padding-left:15px;margin-top:7px;margin-left:5px}.index_conter{line-height:25px;font-size:12px;min-height:40px;padding-left:20px;color:#888}.index_date{position:absolute;left:-90px;top:13px;font-size:13px;color:#333}.index_acive{width:15px;height:15px;background-color:#20a53a;display:block;border-radius:50%;position:absolute;left:-10px;top:21px}.index_acive::after{position:relative;display:block;content:"";height:5px;width:5px;display:block;border-radius:50%;background-color:#fff;top:5px;left:5px}\
                              </style>\
                        </div>'
      });
      var countdown = 5;
      function settime (val) {
        if (countdown == 0) {
          val.removeAttr("disabled");
          $('#update_time').text('');
          return false;
        } else {
          $('#update_time').text('还剩' + countdown + '秒，可点击。');
          countdown--;
          setTimeout(function () {
            settime(val)
          }, 1000)
        }
      }
      settime($('#notice'));
      $('#notice').click(function () {
        if ($(this).prop('checked')) {
          $('.btn_update_panel_beta').removeClass('disabled')
        } else {
          $('.btn_update_panel_beta').addClass('disabled')
        }
      });
      $('.btn_update_panel_beta').click(function () {
        if($(this).hasClass('disabled')){
          layer.tips('请查看并勾选“申请内测须知”', $(this), {tips: [1, '#f00']});
        }else{
          bt.show_confirm('升级Linux内测版', '请仔细阅读内测升级须知，是否升级Linux内测版？', function () {
            bt.send('apple_beta', 'ajax/apple_beta', {}, function (rdata) {
              if (rdata.status === false) {
                bt.msg(rdata)
                return
              }
              bt.system.check_update(function (rdata) {
                index.to_update()
              })
            })
          })
        }
      })
    });
  },
  re_panel: function () {
    layer.confirm(lan.index.rep_panel_msg, { title: lan.index.rep_panel_title, closeBtn: 2, icon: 3 }, function () {
      bt.system.rep_panel(function (rdata) {
        if (rdata.status) {
          bt.msg({ msg: lan.index.rep_panel_ok, icon: 1 });
          return;
        }
        bt.msg(rdata);
      })
    });
  },
  re_server: function () {
    bt.open({
      type: 1,
      title: '重启服务器或者面板',
      area: '330px',
      closeBtn: 2,
      shadeClose: false,
      content: '<div class="rebt-con"><div class="rebt-li"><a data-id="server" href="javascript:;">重启服务器</a></div><div class="rebt-li"><a data-id="panel" href="javascript:;">重启面板</a></div></div>'
    })
    setTimeout(function () {
      $('.rebt-con a').click(function () {
        var type = $(this).attr('data-id');
        switch (type) {
          case 'panel':
            layer.confirm(lan.index.panel_reboot_msg, { title: lan.index.panel_reboot_title, closeBtn: 2, icon: 3 }, function () {
              var loading = bt.load();
              interval_stop = true;
              bt.system.reload_panel(function (rdata) {
                loading.close();
                bt.msg(rdata);
              });
              setTimeout(function () { window.location.reload(); }, 3000);
            });
            break;
          case 'server':
            var rebootbox = bt.open({
              type: 1,
              title: lan.index.reboot_title,
              area: ['466px', '320px'],
              closeBtn: 2,
              shadeClose: false,
              content: "<div class='bt-form bt-window-restart'>\
                  <div class='Restart_content pd20'>\
                  <div class='warning_title'><div class='warning_icon'></div>"+ lan.index.reboot_warning + "</div>\
                  <p style='margin:10px 0'>"+ lan.index.reboot_ps + "</p>\
                  <div class='SafeRestart'>\
                    <div class='info first_info'><span class='first_circle'></span><p>"+ lan.index.reboot_ps_1 + "</p></div>\
                    <div class='info second_info'><span class='second_circle circle_gray'></span><p>"+ lan.index.reboot_ps_2 + "</p></div>\
                    <div class='info third_info'><span class='third_circle circle_gray'></span><p>"+ lan.index.reboot_ps_3 + "</p></div>\
                    <div class='info four_info'><span class='four_circle circle_gray'></span><p>"+ lan.index.reboot_ps_4 + "</p></div>\
									</div>\
									</div>\
									<div class='bt-form-submit-btn'>\
										<button type='button' class='btn btn-danger btn-sm btn-reboot'>"+ lan.public.cancel + "</button>\
										<button type='button' class='btn btn-success btn-sm WSafeRestart' >"+ lan.public.ok + "</button>\
									</div>\
								</div>"
            });
            setTimeout(function () {
              $(".btn-reboot").click(function () {
                rebootbox.close();
              })
              $(".WSafeRestart").click(function () {
                $('.bt-window-restart').parent().parent().css('height', '272px')
                $('.bt-form-submit-btn').fadeOut(500)
                $(".first_info p").text(lan.index.reboot_msg_1 + '...');
                $(".SafeRestart .first_circle").css('backgroundColor', '#20A53A')
                $(".SafeRestart .first_circle").parent('.info').css('color', '#20A53A')
                bt.pub.set_server_status_by("name={{session['webserver']}}&type=stop", function (r1) {
                  $(".second_info p").text(lan.index.reboot_msg_2 + '...');
                  $(".SafeRestart .second_circle").removeClass('circle_gray').addClass('circle_green')
                  $(".SafeRestart .second_circle").css('backgroundColor', '#20A53A')
                  $(".SafeRestart .second_circle").parent('.info').css('color', '#20A53A')
                  bt.pub.set_server_status_by("name=mysqld&type=stop", function (r2) {
                    $(".third_info p").text(lan.index.reboot_msg_3 + '...');
                    $(".SafeRestart .third_circle").removeClass('circle_gray').addClass('circle_green')
                    $(".SafeRestart .third_circle").css('backgroundColor', '#20A53A')
                    $(".SafeRestart .third_circle").parent('.info').css('color', '#20A53A')
                    bt.system.root_reload(function (rdata) {
                      $(".four_info p").text(lan.index.reboot_msg_4 + '...');
                      $(".SafeRestart .four_circle").removeClass('circle_gray').addClass('circle_green')
                      $(".SafeRestart .four_circle").css('backgroundColor', '#20A53A')
                      $(".SafeRestart .four_circle").parent('.info').css('color', '#20A53A')
                      var sEver = setInterval(function () {
                        bt.system.get_total(function () {
                          clearInterval(sEver);
                          setTimeout(function () {
                            layer.closeAll();
                            layer.msg(lan.index.reboot_msg_5, { icon: 1, time: 2000 });
                          }, 3000);
                        })
                      }, 3000);
                    })
                  })
                })
              })
            }, 100)
            break;
        }
      })
    }, 100)
  },
  open_log: function () {
    bt.open({
      type: 1,
      area: '640px',
      title: lan.index.update_log,
      closeBtn: 2,
      shift: 5,
      shadeClose: false,
      content: '<div class="DrawRecordCon"></div>'
    });
    $.get('https://www.bt.cn/Api/getUpdateLogs?type=' + bt.os, function (rdata) {
      var body = '';
      for (var i = 0; i < rdata.length; i++) {
        body += '<div class="DrawRecord DrawRecordlist">\
							<div class="DrawRecordL">'+ rdata[i].addtime + '<i></i></div>\
							<div class="DrawRecordR">\
								<h3>'+ rdata[i].title + '</h3>\
								<p>'+ rdata[i].body + '</p>\
							</div>\
						</div>'
      }
      $(".DrawRecordCon").html(body);
    }, 'jsonp');
  },
  get_cloud_list: function () {
    $.post('/plugin?action=get_soft_list', { type: 8, p: 1, force: 1, cache: 1 }, function (rdata) {
      console.log("已成功从云端获取软件列表");
    });
  },
  // 获取安全风险列表
  get_warning_list: function (active, callback) {
    var that = this, obj = {};
    if (active == true) obj = { force: 1 }
    bt.send('get_list', 'warning/get_list', obj, function (res) {
      if (res.status !== false) {
        that.warning_list = res;
        that.warning_num = res.risk.length;
        $('.warning_num').css('color', (that.warning_num > 0 ? 'red' : '#20a53a')).html(that.warning_num);
        $('.warning_scan_ps').html(that.warning_num > 0 ? ('本次扫描共检测到风险项<i>' + that.warning_num + '</i>个,请及时修复！') : '本次扫描检测无风险项，请继续保持！');
        if (callback) callback(res);
      }
    });
  },
  getScanSpeed: function (sele, msg, url) {
    var that = this;
    if (!$(sele).length) return;
    bt_tools.send({url: url}, function (rdata) {
      body = '<p>正在'+ msg +'，请稍后<img src="/static/img/ing.gif"></p>\
      <div class="bt-progress"><div class="bt-progress-bar" style="width:'+ rdata + '%">\
      <span class="bt-progress-text" style="left: '+ (rdata < 21 ? 3 : rdata - 16 ) +'%;">' + rdata + '%</span></div></div>';
      $(sele).prev().hide();
      $(sele).css({ "margin-left": "-37px", "width": "380px" });
      $(sele).parents(".layui-layer").css({ "margin-left": "-100px" });
      $(sele).html(body);
      setTimeout(function () {
        that.getScanSpeed(sele, msg, url);
      }, 200);
    })
  },
  /**
   * @description 获取时间简化缩写
   * @param {Numbre} dateTimeStamp 需要转换的时间戳
   * @return {String} 简化后的时间格式
   */
  get_simplify_time: function (dateTimeStamp) {
    if (dateTimeStamp === 0) return '刚刚';
    if (dateTimeStamp.toString().length == 10) dateTimeStamp = dateTimeStamp * 1000
    var minute = 1000 * 60, hour = minute * 60, day = hour * 24, halfamonth = day * 15, month = day * 30, now = new Date().getTime(), diffValue = now - dateTimeStamp;
    if (diffValue < 0) return '刚刚';
    var monthC = diffValue / month, weekC = diffValue / (7 * day), dayC = diffValue / day, hourC = diffValue / hour, minC = diffValue / minute;
    if (monthC >= 1) {
      result = "" + parseInt(monthC) + "月前";
    } else if (weekC >= 1) {
      result = "" + parseInt(weekC) + "周前";
    } else if (dayC >= 1) {
      result = "" + parseInt(dayC) + "天前";
    } else if (hourC >= 1) {
      result = "" + parseInt(hourC) + "小时前";
    } else if (minC >= 1) {
      result = "" + parseInt(minC) + "分钟前";
    } else {
      result = "刚刚";
    }
    return result;
  },
  /**
   * @description 渲染安全模块视图
   * @return 无返回值
   */
  reader_warning_view: function () {
    var that = this;
    if(!that.warning_num && that.warning_num !== 0) {
      layer.msg("正在获取安全风险项，请稍后 ...",{icon:0});
      return false;
    }
    function reader_warning_list (data) {
      var html = '', scan_time = '', arry = [['risk', '风险项'], ['security', '无风险项'], ['ignore', '已忽略项']], level = [['低危', '#e8d544'], ['中危', '#E6A23C'], ['高危', 'red']]
      bt.each(arry, function (index, item) {
        var data_item = data[item[0]], data_title = item[1];
        html += '<li class="module_item ' + item[0] + '">' +
            '<div class="module_head">' +
            '<span class="module_title">' + data_title + '</span>' +
            '<span class="module_num">' + data_item.length + '</span>' +
            '<span class="module_cut_show">' + (item[index] == 'risk' && that.warning_num > 0 ? '<i>点击折叠</i><span class="glyphicon glyphicon-menu-up" aria-hidden="false"></span>' : '<i>查看详情</i><span class="glyphicon glyphicon-menu-down" aria-hidden="false"></span>') + '</span>' +
            '</div>' +
            (function (index, item) {
              var htmls = '<ul class="module_details_list ' + (item[0] == 'risk' && that.warning_num > 0 ? 'active' : '') + '">';
              bt.each(data_item, function (indexs, items) {
							if (!items.cve_id) {
                scan_time = items.check_time;
                htmls += '<li class="module_details_item">' +
                    '<div class="module_details_head">' +
                    '<span class="module_details_title"><span title="' + items.ps + '">' + items.ps + '</span><i>（&nbsp;检测时间：' + (that.get_simplify_time(items.check_time) || '刚刚') + '，耗时：' + (items.taking > 1 ? (items.taking + '秒') : ((items.taking * 1000).toFixed(2) + '毫秒')) + '&nbsp;，等级：' + (function (level) {
                      var level_html = '';
                      switch (level) {
                        case 3:
                          level_html += '<span style="color:red">高危</span>';
                          break;
                        case 2:
                          level_html += '<span style="color:#E6A23C">中危</span>';
                          break;
                        case 1:
                          level_html += '<span style="color:#e8d544">低危</span>';
                          break;
                      }
                      return level_html;
                    }(items.level)) + '）</i></span>' +
                    '<span class="operate_tools">' + (item[0] != 'security' ? ('<a href="javascript:;" class="btlink cut_details">详情</a>&nbsp;&nbsp;|&nbsp;&nbsp;<a href="javascript:;" data-model="' + items.m_name + '" data-title="' + items.title + '" ' + (item[0] == 'ignore' ? 'class=\"btlink\"' : '') + ' data-type="' + item[0] + '">' + (item[0] != 'ignore' ? '忽略' : '移除忽略') + '</a>&nbsp;&nbsp;|&nbsp;&nbsp;<a href="javascript:;" class="btlink" data-model="' + items.m_name + '" data-title="' + items.title + '">检测</a>') : '<a href="javascript:;" class="btlink cut_details">详情</a>') + '</span>' +
                    '</div>' +
                    '<div class="module_details_body">' +
                    '<div class="module_details_line">' +
                    '<div class="module_details_block"><span class="line_title">检测类型：</span><span class="line_content">' + items.title + '</span></div>' +
                    '<div class="module_details_block"><span class="line_title">风险等级：</span><span class="line_content" style="color:' + level[items.level - 1][1] + '">' + level[items.level - 1][0] + '</span></div>' +
                    '</div>' +
                    '<div class="module_details_line"><span class="line_title">风险描述：</span><span class="line_content">' + items.msg + '</span></div>' +
                    '<div class="module_details_line"><span class="line_title">' + (item[0] != 'security' ? '解决方案：' : '配置建议') + '</span><span class="line_content">' +
                    (function () {
                      var htmlss = '';
                      bt.each(items.tips, function (indexss, itemss) {
                        htmlss += '<i>' + (indexss + 1) + '、' + itemss + '</i></br>';
                      });
                      return htmlss;
                    }()) + '</span></div>' +
                    '<div class="module_details_line"><span class="line_title">温馨提示：</span><span class="line_content">'+ items.remind +'</span></div>'+
                    (items.help != '' ? ('<div class="module_details_line"><span class="line_title">帮助文档：</span><span class="line_content"><a href="' + items.help + '" target="_blank" class="btlink">' + items.help + '</span></div>') : '') +
                    '</div>' +
                    '</li>';
							} else {
								htmls +=
									'<li class="module_details_item">' +
									'<div class="module_details_head">' +
									'<span class="module_details_title"><span title="' +
									items.vuln_name +
									'">' +
									items.vuln_name +
									'</span><i>（&nbsp;检测时间：' +
									(that.get_simplify_time(items.check_time) || '刚刚') +
									'&nbsp;，等级：' +
									(function (level) {
										var level_html = '';
										switch (level) {
											case 3:
												level_html += '<span style="color:red">高危</span>';
												break;
											case 2:
												level_html += '<span style="color:#E6A23C">中危</span>';
												break;
											case 1:
												level_html += '<span style="color:#e8d544">低危</span>';
												break;
										}
										return level_html;
									})(items.level) +
									'）</i></span>' +
									'<span class="operate_tools">' +
									(item[0] != 'security'
										? '<a href="javascript:;" class="btlink cut_details">详情</a>&nbsp;&nbsp;|&nbsp;&nbsp;<a href="javascript:;" data-title="' +
										  items.vuln_name +
										  '" data-id="' +
										  items.cve_id +
										  '" ' +
										  (item[0] == 'ignore' ? 'class="btlink"' : '') +
										  ' data-type="' +
										  'vuln' +
										  '">' +
										  (item[0] != 'ignore' ? '忽略' : '移除忽略') +
										  '</a>&nbsp;&nbsp;|&nbsp;&nbsp;<a href="javascript:;" class="btlink" data-type="' +
										  'vuln' +
										  '" data-id="' +
										  items.cve_id +
										  '">检测</a>'
										: '<a href="javascript:;" class="btlink cut_details">详情</a>') +
									'</span>' +
									'</div>' +
									'<div class="module_details_body">' +
									'<div class="module_details_line">' +
									'<div class="module_details_block"><span class="line_title">漏洞编号：</span><span class="line_content">' +
									items.cve_id +
									'</span></div>' +
									'<div class="module_details_block"><span class="line_title">风险等级：</span><span class="line_content" style="color:' +
									level[items.level - 1][1] +
									'">' +
									level[items.level - 1][0] +
									'</span></div>' +
									'</div>' +
									'<div class="module_details_line"><span class="line_title">涉及软件：</span><span class="line_content">' +
									(function () {
										var htmlss = '';
										bt.each(items.soft_name, function (indexss, itemss) {
											htmlss += '<i>' + indexss + '&nbsp;:&nbsp;' + itemss + '</i></br>';
                    });
										return htmlss;
									})() +
									'</span></div>' +
									'<div class="module_details_line"><span class="line_title">' +
									(item[0] != 'security' ? '解决方案：' : '配置建议') +
									'</span><span class="line_content">' +
									items.vuln_solution +
									'</span></div>' +
									'</div>' +
									'</li>';
							}
						});

              htmls += '</ul>';
              return htmls;
            }(index, item))
            + '</li>'
      });
      $('.warning_scan_body').html(html);
      scan_time = Date.now() / 1000;
      $('.warning_scan_time').html('检测时间：&nbsp;' + bt.format_data(scan_time)+'<a class="btlink" href="/project/security/report/html" target="_Blank" style="margin-left: 6px;text-decoration: underline;">>>获取检测报告 </a>' );
    }
		var dialog_forbid_data;
		var danger_check_data = [];
    bt.open({
      type: '1',
      title: '安全风险',
      area: ['750px', '700px'],
      skin: 'warning_scan_view',
      content: '<div class="warning_scan_view" style="height: 100%;">' +
          '<div class="warning_scan_head">' +
          '<span class="warning_scan_ps">' + (that.warning_num > 0 ? ('本次扫描共检测到风险项<i>' + that.warning_num + '</i>个,请及时修复！') : '本次扫描检测无风险项，请继续保持！') + '</span>' +
          '<span class="warning_scan_time"></span>' +
          '<button class="warning_auto_repair">一键修复</button>' +
          '<button class="warning_again_scan" style="right:160px;">重新检测</button>' +
          '</div>' +
          '<ol class="warning_scan_body" style="min-height: 528px;"></ol>' +
          '</div>',
      success: function () {
				//检测按钮
        $('.warning_again_scan').click(function () {
          var loadT = bt.load("<div class='myspeed'>正在重新检测安全风险，请稍候...</div>");
          setTimeout(function () {
            that.getScanSpeed('.myspeed','重新检测安全风险', '/warning?action=get_scan_bar')
          },50)
          that.get_warning_list(true, function () {
            layer.msg('扫描成功', { icon: 1 });
            reader_warning_list(that.warning_list);
              if (that.warning_list.risk.length == 0) {
                  $('.warning_auto_repair').css('display', 'none')
                  $('.warning_again_scan').css('right', '20px')
              }else{
                  $('.warning_auto_repair').css('display', 'inline')
                  $('.warning_again_scan').css('right', '160px')
              }
          });
        });
        bt_tools.send({url:'/warning?action=get_list'},function(warInfo) {
          // 显示数据
          if (that.warning_list.risk.length == 0) {
            $('.warning_auto_repair').css('display', 'none')
            $('.warning_again_scan').css('right', '20px')
          }
					//一键修复按钮
          $('.warning_auto_repair').click(function () {
            if(bt.get_cookie('ltd_end') < 0){
              var item = {
                ps:'针对扫描服务器系统的漏洞、设置等安全问题提供自动修复方案，并针对扫描出的风险项进行自动一键修复',
                description:['自动修复方案','修复结果展示','人工辅助修复'],
                pluginName:'风险一键修复',
                preview:false,
                imgSrc:'/static/images/recommend/autoRepair.png'
              }
              product_recommend.recommend_product_view(item,undefined,'ltd',68,'ltd')
              return
            }
            dialog_forbid_data = [];
            danger_check_data = [];
            $.each(that.warning_list.risk, function (index_c, item_c) {
              //可修复项
							if (!item_c.cve_id) {
                if ($.inArray(item_c.m_name, warInfo.is_autofix) != -1) {
                    danger_check_data.push(item_c);
                } else {
                    dialog_forbid_data.push(item_c);
                }
							} else {
								if ($.inArray(item_c.cve_id, warInfo.is_autofix) != -1) {
									item_c['title']='系统漏洞'
									item_c['ps']=item_c.vuln_name
									danger_check_data.push(item_c);
								} else {
									item_c['ps']=item_c.vuln_name
									dialog_forbid_data.push(item_c);
								}
							}

            });

            var contentHtml =
                '<div class="dialog">\
                <div class="forbid">\
                    <div class="forbid_title">\
                        <div>\
                            <span>存在<span style="font-weight:600">' + dialog_forbid_data.length + '</span>项风险不可进行一键修复</span>\
									<span class="btlink"><a class="btlink" id="look_detail">查看详情</a><div class="daily_details_mask bgw hide"></div></span>\
								</div>\
								<span class="btlink warning_repair_scan" style="display:flex;align-items:center;margin-bottom:2px;"><span class="warning_scan_icon"></span><span style="border-bottom:1px solid #20a53a;height:22px">联系人工修复</span></span>\
							</div>\
							<div class="forbid_content">\
								<p>\
									以上<span style="font-weight:600">' + dialog_forbid_data.length + '</span>项一键修复后可能会导致网站正常访问，服务运行异常等（请手动修复）\
								</p>\
							</div>\
						</div>\
						<div class="auto_content">\
							<div>\
								<span id="choose_auto_repair">请选择需要修复的风险项（已选中：<span id="danger_length" style="font-weight:600">' + 0 + '</span>项）</span>\
								<div id="auto_repair"></div>\
							</div>\
						</div>\
						<div class="confirm_button">\
              <span style="font-size:12px;color:#f39c12;margin-right:8px">如果安装了【系统加固】，请先关闭再一键修复</span>\
							<span id="is_ltd" style="font-size:12px;color:#f39c12;margin-right:8px">此功能为企业版专享功能，您当前还不是企业用户，<span class="btlink openLtd">立即升级</span></span>\
							<button id="confirm_button" class="button-link">一键修复</button>\
						</div>\
					</div>';

            if (!dialog_forbid_data.length || !danger_check_data.length) height = true
            var check_data
            var height = false
            layer.open({
              title: '一键修复确认信息',
              content: contentHtml,
              btn: false,
              closeBtn: 2,
              area: height ? ['600px', '350px'] : ['600px', '420px'],
              success: function (layero, index) {
                check_data = bt_tools.table({
                  el: '#auto_repair',
                  data: danger_check_data,
                  load: true,
                  height: '178px',
                  column: [
                    {
                      type: 'checkbox',
                      width: 20
                    },
                    {
                      fid: 'title',
                      title: '检测类型',
                    },
                    {
                      fid: 'ps',
                      title: '风险项',
                    },
                    {
                      fid: 'level',
                      title: '风险等级',
                      width: 100,
                      template: function (row) {
                        return row.level == 1 ? '<span style="color:#e8d544">低危</span>' : row.level == 2 ? '<span style="color:#E6A23C">中危</span>' : '<span style="color:red">高危</span>'
                      }
                    }
                  ]
                });
                // 判定表格选中长度
                $('#auto_repair tbody input,#auto_repair thead input').change(function () {
                  $('#danger_length').text(check_data.checkbox_list.length)
                  if (check_data.checkbox_list.length) {
                    $('#confirm_button').attr('disabled', false)
                    $('#confirm_button').css('background-color', '#20a53a')
                  } else {
                    $('#confirm_button').attr('disabled', true)
                    $('#confirm_button').css('background-color', 'rgb(203, 203, 203)')
                  }
                })
                // 不存在不可修复项时
                if (!dialog_forbid_data.length) {
                  $('#choose_auto_repair').html('请选择需要修复的风险项（已选中：<span id="danger_length" style="font-weight:600">' + 0 + '</span>项）</span>')
                  $('.forbid').css('display', 'none')
                  $('.dialog').find('hr').css('display', 'none')
                }
                if (!danger_check_data.length) {
                  $('.dialog').find('hr').css('display', 'none')
                  $('#choose_auto_repair').html('当前暂无可一键修复的风险项！')
                  $('#confirm_button').attr('disabled', true)
                  $('#confirm_button').css('background-color', 'rgb(203, 203, 203)')
                }
                // 一键修复
                $('#confirm_button').click(function (e) {
                  if (check_data.checkbox_list.length != 0) {
                    var danger_selected_data = []
                    $.each(check_data.checkbox_list, function (index, item) {
											danger_selected_data.push(danger_check_data[item].m_name||danger_check_data[item].cve_id);
										});
										that.auto_repair(danger_selected_data, that.warning_list);
                  } else {
                    layer.msg( '当前无选中风险项!',{ type:1 })
                    e.stopPropagation();
                    e.preventDefault();
                  }
                })
                // 查看详情列表
                var _details = '<div class="divtable daliy_details_table"><table class="table table-hover">',
                    thead = '', _tr = '';
                $.each(dialog_forbid_data, function (index, item) {
                  _tr += '<tr><td style="width:34px;height:25px;text-align:center">' + (index + 1) + '</td><td><span class="overflow_hide" style="width:230px" title="' + item.m_name + '">' + item.ps + '</span></td></tr>'
                })
                thead = '<thead><tr><th colspan="2">以下' + dialog_forbid_data.length + '项不可进行一键修复</th></tr></thead>'
                _details += thead + '<tbody>' + _tr + '</tbody></table></div>';
                $('.daily_details_mask').html(_details)

                $('#look_detail').on('click', function (e) {
                  $('.daily_details_mask').prev('a').css('color', '#23527c');
                  if (e.target.localName == 'a') {
                    if ($('.daily_details_mask').hasClass('hide')) {
                      $('.daily_details_mask').removeClass('hide').css({left: 260, top: 45})
                    } else {
                      $('.daily_details_mask').addClass('hide')
                      $('.daily_details_mask').prev('a').removeAttr('style')
                    }
                  }
                  $(document).click(function (ev) {
                    $('.daily_details_mask').addClass('hide').prev('a').removeAttr('style')
                    ev.stopPropagation();
                  })
                  e.stopPropagation();
                })

                // 联系客服
                $('.warning_repair_scan').click(function () {
                  bt.onlineService();
                });
                $('i[data-checkbox=all]').click()

                // 是否为企业版
                var ltd = parseInt(bt.get_cookie('ltd_end') || -1);
                if (ltd > 0) {
                  $('#is_ltd').css('display', 'none')
                } else {
                  $('#is_ltd').prev().hide()
                  $('#confirm_button').attr('disabled', true)
                  $('#confirm_button').css('background-color', 'rgb(203, 203, 203)')
                }
                $('.openLtd').click(function () {
                  var item = {
                    ps:'针对扫描服务器系统的漏洞、设置等安全问题提供自动修复方案，并针对扫描出的风险项进行自动一键修复',
                    description:['自动修复方案','修复结果展示','人工辅助修复'],
                    pluginName:'风险一键修复',
                    preview:false,
                    imgSrc:'https://www.bt.cn/Public/new/plugin/introduce/home/autoRepair.png'
                  }
                  bt.soft.product_pay_view({ totalNum: 68, limit: 'ltd', closePro: true,pluginName:item.pluginName,fun:function () {
                    product_recommend.recommend_product_view(item, undefined, 'ltd', 68, 'ltd',true)
                  }})
                })
              },
            });
          });
					//3个大的下来的点击事件
          $('.warning_scan_body').on('click', '.module_item .module_head', function () {
            var _parent = $(this).parent(), _parent_index = _parent.index(), _list = $(this).next();
            if (parseInt($(this).find('.module_num').text()) > 0) {
              if (_list.hasClass('active')) {
                _list.css('height', 0);
                $(this).find('.module_cut_show i').text('查看详情').next().removeClass('glyphicon-menu-up').addClass('glyphicon-menu-down');
                setTimeout(function () {
                  _list.removeClass('active').removeAttr('style');
                }, 500);
              } else {
                $(this).find('.module_cut_show i').text('点击折叠').next().removeClass('glyphicon-menu-down').addClass('glyphicon-menu-up');
                _list.addClass('active');
                var details_list = _list.parent().siblings().find('.module_details_list');
                details_list.removeClass('active');
                details_list.prev().find('.module_cut_show i').text('查看详情').next().removeClass('glyphicon-menu-up').addClass('glyphicon-menu-down')
              }
            }
          });
          $('.warning_repair_scan').click(function () {
						bt.onlineService();
					});
					// 右边的操作
          $('.warning_scan_body').on('click', '.operate_tools a', function () {
            var index = $(this).index(), data = $(this).data();
            switch (index) {
              case 0:
                if ($(this).hasClass('active')) {
                  $(this).parents('.module_details_head').next().hide();
                  $(this).removeClass('active').text('详情');
                } else {
                  var item = $(this).parents('.module_details_item'), indexs = item.index();
                  $(this).addClass('active').text('折叠');
                  item.siblings().find('.module_details_body').hide();
                  item.siblings().find('.operate_tools a:eq(0)').removeClass('active').text('详情');
                  $(this).parents('.module_details_head').next().show();
                  $('.module_details_list').scrollTop(indexs * 41);
                }
                break;
              case 1:
                if (data.type != 'ignore') {
									bt.confirm({ title: '忽略风险', msg: '是否忽略【' + data.title + '】风险,是否继续?' }, function () {
										if (data.type != 'vuln') {
                        that.warning_set_ignore(data.model, function (res) {
                          that.get_warning_list(false, function () {
                            if (!that.warning_list.risk.length) {
                              $('.warning_auto_repair').css('display', 'none')
                              $('.warning_again_scan').css('right', '40px')
                            }
                            bt.msg(res)
                            reader_warning_list(that.warning_list);
                          });
                        });
										} else {
											// console.log('漏洞的');
											that.bug_set_ignore(data.id, function (res) {
												that.get_warning_list(false, function () {
													if (!that.warning_list.risk.length) {
														$('.warning_auto_repair').css('display', 'none');
														$('.warning_again_scan').css('right', '40px');
													}
													bt.msg(res);
													reader_warning_list(that.warning_list);
                        });
											});
										}
									});
                } else {
                  that.warning_set_ignore(data.model, function (res) {
                    that.get_warning_list(false, function () {
                      bt.msg(res)
                      reader_warning_list(that.warning_list);
                      if (that.warning_list.risk.length) {
                        $('.warning_auto_repair').css('display', 'inline')
                        $('.warning_again_scan').css('right', '160px')
                      }
                      setTimeout(function () {
                        $('.module_item.ignore').click();
                      }, 100)
                    });
                  });
                }
                break;
              case 2:
								if (data.type != 'vuln') {
                  that.waring_check_find(data.model, function (res) {
                    that.get_warning_list(false, function () {
                        bt.msg(res);
                      reader_warning_list(that.warning_list);
                    });
                  });
								} else {
									that.bug_check_find(data.id, function (res) {
										that.get_warning_list(false, function () {
											bt.msg(res);
											reader_warning_list(that.warning_list);
										});
									});
								}
                break;
            }
          });
          reader_warning_list(that.warning_list);
        })
      }
    })
  },
  /**
   * @description 安全风险指定模块检查
   * @param {String} model_name 模块名称
   * @param {Function} callback 成功后的回调
   * @return 无返回值
   */
  waring_check_find: function (model_name, callback) {
    var loadT = layer.msg('正在检测指定模块，请稍候...', { icon: 16, time: 0 });
    bt.send('check_find', 'warning/check_find', { m_name: model_name }, function (res) {
      if (res.status !== false) {
        if (callback) callback(res);
      }
    });
	},
	/**
	 * @description 安全风险指定模块[漏洞]的检查
	 * @param {String} cve_id 漏洞编号
	 * @param {Function} callback 成功后的回调
	 * @return 无返回值
	 */
	bug_check_find: function (cve_id, callback) {
		var loadT = layer.msg('正在检测指定模块，请稍候...', { icon: 16, time: 0 });
		bt.send('check_cve', 'warning/check_cve', { cve_id: cve_id }, function (res) {
			if (res.status !== false) {
				if (callback) callback(res);
			}
		});
	},

 /**
  * @description:  安全风险一键修复
  * @param {*} params 选中的修复项的数组
  * @param {*} data 原先的数组
  * @return {*}
  */
	auto_repair: function (params, data) {
		var that = this
		var res_data = [];
    var loadT = bt.load('<div class="repair_speed">正在修复安全风险，请稍候...</div>')
    setTimeout(function () {
      that.getScanSpeed('.repair_speed','修复安全风险', '/safe/security/get_repair_bar')
    }, 50)
		$.post(
			'/safe/security/set_security',
			{ data: JSON.stringify({ m_name: params }) },
			function (rdata) {
				if(rdata.msg == '当前功能为企业版专享'){
					layer.msg(rdata.msg)
					return
				}
				var res_item = {};
				res_data = [];
				$.each(rdata.success, function (index, item) {
					res_item.status = item.result.status;
					res_item.type = item.result.type;
					res_item.msg = item.result.msg;
					res_item.m_name = item.m_name;
					res_data.push(res_item);
					res_item = {};
				});
				$.each(rdata.failed, function (index, item) {
					res_item.status = item.result.status;
					res_item.type = item.result.type;
					res_item.msg = item.result.msg;
					res_item.m_name = item.m_name;
					res_data.push(res_item);
					res_item = {};
				});
				if (rdata.cannot_automatically.length) {
					$.each(rdata.cannot_automatically, function (index, item) {
						res_item.m_name = item;
						res_item.status = 'ignore'
						res_data.push(res_item);
						res_item = {};
					});
				}
				var result_table ='<div><p style="margin-bottom:20px;font-size:16px">修复结果：修复成功<span style="color:#20a53a">'+ rdata.success.length + '</span>项，修复失败<span style="color:red">' + rdata.failed.length + '</span>项，忽略<span style="color:#b9b9b9">' + rdata.cannot_automatically.length + '</span>项</p><div id="auto_repair_result"></div></div>'+
                    '<div class="forbid_content"><p style="margin-bottom:20px;font-size:12px">关闭后将自动重新检测风险项，如未重新检测请手动点击【重新检测】按钮</br>如有修复失败项，请关闭当前窗口，根据解决方案手动进行修复</div>';
				layer.open({
					title: '结果确认',
					content: result_table,
					closeBtn: 2,
					area: '540px',
					btn: false,
					success: function (layero, index) {
						$('#auto_repair_result').empty();
						bt_tools.table({
							el: '#auto_repair_result',
							data: res_data,
							load: true,
							height: '240px',
							column: [
								{
									type: 'text',
									title: '风险项',
									template: function (row) {
										var rowData;
										$.each(data.risk, function (index_d, item_d) {
										if (!item_d.cve_id) {
                        if (item_d.m_name == row.m_name) {
                          rowData = '<span>' + item_d.title + '</span>';
                        }
                    }else{
                        rowData = '<span>' + row.m_name + '</span>';
                    }

										});
										return rowData;
									},
								},
								{
									type: 'text',
									title: '相关信息(网站名或其他)',
									width:200,
									template: function (row) {
										if (row.type.length) {
											if(Array.isArray(row.type)) {
											var data = row.type.join(',')
												return '<span  class="result_span">'+data+'</span>';
											}
											return '<span class="result_span">'+ row.type +'</span>'
										} else {
											return '<span>--</span>';
										}
									},
								},
								{
									title: '操作事项',
									type: 'text',
									align: 'right',
									template: function (row) {
										if (row.status == false) {
											return '<span style="color:red">修复失败</span>';
										} else if (row.status == true) {
											return '<span style="color:#20a53a">修复成功</span>';
										} else if (row.status == 'ignore') {
											return '<span style="color:rgb(102, 102, 102)">忽略风险项</span>';
										}
									},
								},
							],
						});
					},
					cancel: function (index, layers) {
						res_data = [];
						layer.close(index);
						var loadT = layer.msg('正在重新检测安全风险，请稍候...', {
							icon: 16,
						});
						$('.warning_again_scan').click()
					},
				});
			}
		);
	},
  /**
   * @description 安全风险指定模块是否忽略
   * @param {String} model_name 模块名称
   * @param {Function} callback 成功后的回调
   * @return 无返回值
   */
  warning_set_ignore: function (model_name, callback) {
    var loadT = layer.msg('正在设置模块状态，请稍候...', { icon: 16, time: 0 });
    bt.send('set_ignore', 'warning/set_ignore', { m_name: model_name }, function (res) {
      bt.msg(res);
      if (res.status !== false) {
        if (callback) callback(res);
      }
    });
  },
	/**
	 * @description 安全风险指定漏洞是否忽略
	 * @param {String} cve_id 漏洞id
	 * @param {Function} callback 成功后的回调
	 * @return 无返回值
	 */
	bug_set_ignore: function (cve_id, callback) {
		var loadT = layer.msg('正在设置模块状态，请稍候...', { icon: 16, time: 0 });
		bt.send('set_vuln_ignore', 'warning/set_vuln_ignore', { cve_list: JSON.stringify([cve_id]) }, function (res) {
			bt.msg(res);
			if (res.status !== false) {
				if (callback) callback(res);
			}
		});
	},
  /**
   * @description 获取当前的产品状态
   */
  get_product_status: function (callback) {
    // var loadT = layer.msg('正在获取产品状态，请稍候...', { icon: 16, time: 0 })
    bt.send('get_pd', 'ajax/get_pd', {}, function (res) {
      $('.btpro-gray').replaceWith($(res[0]));
      if(res[1] > 1 || res[2] > 1){   //专业版、企业版到期时间大于1  将续费事件赋予最外层span
        var thatClass = $('.index-pos-box .pull-right span').first().prop('class')
        var _event = $('.'+thatClass+' a').attr('onclick')
        var _event = $('.'+thatClass+' a').attr('onclick')
        $('.'+thatClass).children('a').removeAttr('onclick')
        $('.'+thatClass).html($('.'+thatClass).html())
        $('.'+thatClass).click(function() {
          eval(_event)
        }) // 删除原有事件，防止二次触发
      }
      bt.set_cookie('pro_end', res[1]);
      bt.set_cookie('ltd_end', res[2]);
      if(res[1] === 0){
        $(".btpro span").click(function(e){
          layer.confirm('切换回免费版可通过解绑账号实现', { icon: 3, btn: ['解绑账号'], closeBtn: 2, title: '是否取消授权' }, function () {
            $.post('/ssl?action=DelToken', {}, function (rdata) {
              layer.msg(rdata.msg);
              setTimeout(function () {
                window.location.reload();
              },2000);
            });
          });
          e.stopPropagation();
        });
      }
      if(callback) callback();
    })
  },
  /**
   * @description 推荐进阶版产品
   */
  recommend_paid_version: function () {
    try {
      var recomConfig = product_recommend.get_recommend_type(0)
      var pay_status = product_recommend.get_pay_status()
      var is_pay = pay_status.is_pay;
      var advanced =  pay_status.advanced;
      var end_time = pay_status.end_time;
      var html = '',list_html = '';
      if(!is_pay) advanced = ''; //未购买的时候，使用推荐内容
      if(recomConfig){
        var item = recomConfig;
        for (var j = 0; j < item['ps'].length; j++) {
          var element = item['ps'][j];
          list_html += '<div class="item">'+ element +'</div>';
        }
        var pay_html = '',more_html = ''
        if(is_pay){
          pay_html = '<div class="product-buy product-ltd '+ (advanced || item.name) +'-type">到期时间：<span>'+ (end_time === 0?'永久授权':(end_time === -2?'已过期':bt.format_data(end_time,'yyyy-MM-dd')) + '&nbsp;&nbsp;<a class="btlink" href="javascript:;" onclick="product_recommend.pay_product_sign(\''+ advanced +'\','+ item.pay +',\''+ advanced +'\')">续费</a>') +'</span></div>'
        }else{
					// more_html += '<div class="product-more">查看更多>></div>'
          pay_html = '<div class="product-buy"><button type="button" onclick="product_recommend.pay_product_sign(\''+ (advanced || item.name) +'\','+ item.pay +',\'ltd\')"><span class="recommend-pay-icon"></span>立即升级</button></div>'
        }
        html = '<div class="conter-box bgw">\
          <div class="recommend-top radius4 '+ (is_pay?( advanced +'-bg recommend-ltd'):'') +'">'+ (!is_pay?pay_html:'') +'<div class="product-ico '+ (advanced || item.name) +''+ (!is_pay?'-pay':'') +'-ico"></div>' + (is_pay?pay_html:'') +'\
            <div class="product-label">'+ list_html +'</div>\
            '+ more_html +'\
          </div>\
        </div>'
        //交互优化------普通用户才显示横幅
        var day_not_display = bt.get_storage('home_day_not_display') //获取不再显示最终的时间戳
        if((day_not_display && parseInt(day_not_display) < new Date().getTime()) || !day_not_display) $('#home-recommend').html(html)
        $('#home-recommend').hover(function(){
          if(!$('#home-recommend .day-not-display').length) $(this).css('position','relative').append('<div class="day-not-display">近'+ (is_pay ? '3天' : '24小时') +'不再显示<span></span></div>')
          $('#home-recommend .day-not-display').fadeIn("1000")
          $('#home-recommend .day-not-display span').unbind('click').click(function(){
            bt.set_storage('home_day_not_display', (new Date().getTime() + 86400*1000*(is_pay ? 3 : 1)))  //设置3天不再显示最后的时间戳
            $('#home-recommend').empty()
          })
        },function(){
          $('#home-recommend .day-not-display').hide()
        })
        //交互优化------普通用户才显示横幅end
        $('.product-more').unbind('click').click(function(){
          bt.soft.privilege_contrast()
        })
      }
    } catch (error) {
      console.log(error)
    }
  },
  /**
   * @description 推荐任务管理器
   */
  recommend_task_manager: function () {

  }
}
index.get_init();
index.consultancy_services()
//setTimeout(function () { index.get_cloud_list() }, 800);

product_recommend.init(function(){
  index.get_product_status(function(){
    index.recommend_paid_version()
  });
  index.get_index_list();
})
