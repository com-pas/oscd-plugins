<SCL>
    <IED name="IED_Max_GSEControl_Reached">
        <Services>
            <ConfDataSet max="1" maxAttributes="15" />
            <GOOSE max="1" />
        </Services>
        <AccessPoint name="AP1">
            <Server>
                <LDevice inst="ldInst1">
                    <LN0 lnClass="LLN0" inst="" lnType="LLN0">
                        <GSEControl name="gse1" type="GSSE" appID="" securityEnabled="Signature" fixedOffs="true" />
                    </LN0>
                </LDevice>
            </Server>
        </AccessPoint>
    </IED>
</SCL>
