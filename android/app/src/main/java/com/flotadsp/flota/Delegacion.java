package com.flotadsp.flota;

import com.google.androidbrowserhelper.playbilling.digitalgoods.DigitalGoodsRequestHandler;
import com.google.androidbrowserhelper.trusted.DelegationService;

/**
 * El servicio que habla con Chrome. Además de lo de siempre, contesta a la
 * Digital Goods API de la web: precios de las suscripciones y compras que ya
 * tiene la cuenta de Google (para restaurarlas al reinstalar).
 */
public class Delegacion extends DelegationService {
    @Override
    public void onCreate() {
        super.onCreate();
        registerExtraCommandHandler(new DigitalGoodsRequestHandler(getApplicationContext()));
    }
}
