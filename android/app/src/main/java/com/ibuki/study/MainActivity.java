package com.ibuki.study;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    public static final String EXTRA_ROUTE = "ibuki_route";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(StudyWidgetPlugin.class);
        super.onCreate(savedInstanceState);
        openRequestedRoute(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        openRequestedRoute(intent);
    }

    private void openRequestedRoute(Intent intent) {
        if (intent == null || bridge == null) return;
        String route = intent.getStringExtra(EXTRA_ROUTE);
        if (route == null || !route.startsWith("/")) return;
        bridge.getWebView().post(() -> bridge.getWebView().loadUrl(bridge.getLocalUrl() + route));
    }
}
