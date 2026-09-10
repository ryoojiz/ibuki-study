package com.ibuki.study;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "StudyWidget")
public class StudyWidgetPlugin extends Plugin {
    static final String PREFS = "ibuki_study_widget";
    static final String KEY_STREAK = "streak";
    static final String KEY_STUDIED_TODAY = "studied_today";
    static final String KEY_SYNC_DATE = "sync_date";

    @PluginMethod
    public void sync(PluginCall call) {
        int streak = Math.max(0, call.getInt("streak", 0));
        boolean studiedToday = Boolean.TRUE.equals(call.getBoolean("studiedToday", false));
        preferences().edit()
            .putInt(KEY_STREAK, streak)
            .putBoolean(KEY_STUDIED_TODAY, studiedToday)
            .putString(KEY_SYNC_DATE, StudyWidgetProvider.localDate())
            .apply();
        StudyWidgetProvider.updateAll(getContext());
        JSObject result = new JSObject();
        result.put("updated", true);
        call.resolve(result);
    }

    @PluginMethod
    public void clear(PluginCall call) {
        preferences().edit().clear().apply();
        StudyWidgetProvider.updateAll(getContext());
        call.resolve();
    }

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
