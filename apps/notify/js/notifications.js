OC.notify = {
    autoRefresh: true,
    refreshInterval: 30,
	dom: {
		icon: $('<a id="notify-icon" class="header-right header-action" href="#" title=""><img class="svg" alt="" src="" /></a>'),
		counter: $('<span id="notify-counter" data-count="0">0</span>'),
		listContainer: $('<div id="notify-list" class="hidden"><strong>' + t('notify', 'Notifications') + '</strong></div>'),
		list: $('<ul></ul>'),
		stretchContainer: false,
		fitContainerSize: function() {
			if(OC.notify.dom.listContainer.is(':hidden')) {
				return;
			}
			if(parseInt(OC.notify.dom.listContainer.css('bottom', 'auto').css('bottom')) < 0) {
				OC.notify.dom.listContainer.css('bottom', 0);
			}
		}
	},
	notificationTemplate: $('<li class="notification"><a class="content" href="#"></a><div class="actionicons"><span class="readicon read" title="' + t('notify', 'Mark as unread') + '">read</span><span class="readicon unread" title="' + t('notify', 'Mark as read') + '">unread</span><span class="deleteicon" title="' + t('notify', 'Delete this notification') + '">delete</span></div></li>'),
	notifications: [],
	addNotification: function(notification) {
		OC.notify.notifications[parseInt(notification.id)] = notification;
		OC.notify.notificationTemplate.clone().attr({
			'data-id': parseInt(notification.id),
			'title': notification.moment,
			'data-read': notification.read
		}).appendTo(OC.notify.dom.list).find('a.content').attr('href', notification.href).html(notification.content);
		OC.notify.dom.fitContainerSize();
	},
    timeoutId: null,
	loaded: false,
	updated: false,
    setCount: function(count) {
		if(count < 0) {
			count = 0;
		}
		OC.notify.dom.counter.attr("data-count", count).text(count);
		OC.notify.setDocTitle();
	},
	changeCount: function(diff) {
		var count = parseInt(OC.notify.dom.counter.attr("data-count"));
		OC.notify.setCount(count + diff);
	},
	originalDocTitle: document.title,
	setDocTitle: function() {
		if(!document.title.match(/^\([0-9]+\) /)) {
			OC.notify.originalDocTitle = document.title;
		}
		var count = parseInt(OC.notify.dom.counter.attr("data-count"));
		if(count > 0) {
			document.title = "(" + count + ") " + OC.notify.originalDocTitle;
		} else {
			document.title = OC.notify.originalDocTitle;
		}
	},
	startRefresh: function(msec) {
		OC.notify.stopRefresh();
		if(typeof(msec) == 'undefined') {
			msec = parseInt(OC.notify.refreshInterval) * 1000;
		}
		OC.notify.timeoutId = window.setTimeout(OC.notify.refresh, msec, msec);
	},
	refresh: function(msec) {
		OC.notify.getCount().success(function(data) {
			OC.notify.timeoutId = window.setTimeout(OC.notify.refresh, msec, msec);
		});
	},
	stopRefresh: function() {
		if(typeof(OC.notify.timeoutId) == 'number') {
			window.clearTimeout(OC.notify.timeoutId);
			OC.notify.timeoutId = null;
		}
	},
	markAllRead: function() {
		return $.post(
			OC.filePath('notify', 'ajax', 'markAllRead.php'),
			null,
			function(data) {
				if(data.status == 'success') {
					$('.notification').attr('data-read', 1);
					OC.notify.setCount(0);
					OC.notify.dom.icon.click();
				}
			}
		);
	},
	markRead: function(id, read) {
		console.log("markRead", id, read);
		var notify = $('.notification[data-id="' + id + '"]');
		if(typeof(read) == "undefined") {
			read = (notify.attr('data-read') == '0');
		}
		return $.post(
			OC.filePath('notify', 'ajax', 'markRead.php'),
			{id: id, read: read ? 1 : 0},
			function(data) {
				if(data.status == "success") {
					notify.attr('data-read', read ? 1 : 0);
					OC.notify.setCount(data.unread);
				}
			}
		);
	},
	delete: function(id) {
		console.log("delete", id);
		var notify = $('.notification[data-id="' + id + '"]');
		return $.post(
			OC.filePath('notify', 'ajax', 'delete.php'),
			{id: id},
			function(data) {
				if(data.status == "success" && parseInt(data.num)) {
					if(notify.attr('data-read') == "0") {
						OC.notify.changeCount(-1);
					}
					notify.fadeOut('slow', function() { $(this).remove(); OC.notify.dom.fitContainerSize(); });
					delete OC.notify.notifications[parseInt(id)];
				}
			}
		);
	},
	getCount: function() {
		var current = parseInt(OC.notify.dom.counter.attr("data-count"));
		return $.post(
			OC.filePath('notify','ajax','getCount.php'),
			null,
			function(data) {
				var count = parseInt(data);
				if(count != current) {
					OC.notify.setCount(parseInt(data));
					OC.notify.updated = true;
				}
			}
		);
	},
	getNotifications: function() {
		return $.post(
			OC.filePath('notify','ajax','getNotifications.php'),
			null,
			function(data) {
				OC.notify.notifications = new Array();
				OC.notify.dom.list.empty();
				$(data).each(function(i, n) {
					OC.notify.addNotification(n);
				});
				OC.notify.loaded = true;
				OC.notify.updated = false;
				//FIXME: trigger custom events!!
			}
		);
	}
};

$(document).ready(function() {
	OC.notify.dom.icon.append(OC.notify.dom.counter).click(function(event) {
		if(!OC.notify.loaded || OC.notify.updated) {
			OC.notify.getNotifications();
		}
		OC.notify.dom.listContainer.slideToggle('slow', OC.notify.dom.fitContainerSize);
		return false;
	}).attr('title', t('notify', 'Notifications'))
		.children('img').attr('alt', t('notify', 'Notifications')).attr('src', OC.imagePath('notify', 'headerIcon.svg'));
    OC.notify.dom.listContainer.append(OC.notify.dom.list).click(false).on('click', '.readicon', function(e) {
		OC.notify.markRead($(this).parentsUntil('.notification').parent().attr('data-id'), $(this).hasClass('unread'));
		return false;
	}).on('click', '.deleteicon', function(e) {
		OC.notify.delete($(this).parentsUntil('.notification').parent().attr('data-id'));
		return false;
	});
    $(window).click(function(e) {
        OC.notify.dom.listContainer.slideUp();
    }).resize(OC.notify.dom.fitContainerSize);
    $('<span id="readAllNotifications">mark all as read</span>').click(OC.notify.markAllRead).appendTo(OC.notify.dom.listContainer).after(' | ');
    $('<span id="refreshNotificationList">refresh the list</span>').click(OC.notify.getNotifications).appendTo(OC.notify.dom.listContainer);
    OC.notify.dom.icon.appendTo('#header').after(OC.notify.dom.listContainer);
    OC.notify.setDocTitle();
    OC.notify.getCount().success(function() {
		if(OC.notify.autoRefresh) {
			OC.notify.startRefresh();
		}
	});
});
