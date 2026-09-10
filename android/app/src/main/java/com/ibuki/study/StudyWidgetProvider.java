package com.ibuki.study;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class StudyWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) update(context, manager, appWidgetId);
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName provider = new ComponentName(context, StudyWidgetProvider.class);
        for (int appWidgetId : manager.getAppWidgetIds(provider)) update(context, manager, appWidgetId);
    }

    private static void update(Context context, AppWidgetManager manager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(StudyWidgetPlugin.PREFS, Context.MODE_PRIVATE);
        boolean hasData = prefs.contains(StudyWidgetPlugin.KEY_STREAK);
        boolean sameDay = localDate().equals(prefs.getString(StudyWidgetPlugin.KEY_SYNC_DATE, ""));
        int streak = sameDay ? prefs.getInt(StudyWidgetPlugin.KEY_STREAK, 0) : 0;
        boolean studiedToday = sameDay && prefs.getBoolean(StudyWidgetPlugin.KEY_STUDIED_TODAY, false);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.study_widget);
        views.setTextViewText(R.id.widget_streak, hasData ? context.getString(R.string.widget_streak, streak) : context.getString(R.string.widget_sign_in));
        views.setTextViewText(R.id.widget_status, studiedToday ? context.getString(R.string.widget_done_today) : context.getString(R.string.widget_study_prompt));
        views.setOnClickPendingIntent(R.id.widget_quick_study, routeIntent(context, "/", 1));
        views.setOnClickPendingIntent(R.id.widget_global_chat, routeIntent(context, "/chat/global", 2));
        views.setOnClickPendingIntent(R.id.widget_new_notebook, routeIntent(context, "/create", 3));
        manager.updateAppWidget(appWidgetId, views);
    }

    private static PendingIntent routeIntent(Context context, String route, int requestCode) {
        Intent intent = new Intent(context, MainActivity.class)
            .putExtra(MainActivity.EXTRA_ROUTE, route)
            .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static String localDate() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }
}
