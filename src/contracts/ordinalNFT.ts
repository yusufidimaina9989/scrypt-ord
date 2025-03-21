/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-useless-escape */
import {
    ByteString,
    method,
    SmartContract,
    toByteString,
    Utils,
    assert,
    prop,
    bsv,
    MethodCallTxBuilder,
    MethodCallOptions,
    ContractTransaction,
    StatefulNext,
    UTXO,
} from 'scrypt-ts'
import { Inscription, NFTReceiver, ORDMethodCallOptions } from '../types'
import { Ordinal } from './ordinal'
import { OneSatApis } from '../1satApis'
import { ContentType } from '../contentType'

export abstract class OrdinalNFT extends SmartContract {
    @prop(true)
    isOneSatNFT: boolean

    constructor() {
        super()
        this.isOneSatNFT = true
    }

    @method()
    buildStateOutputNFT(): ByteString {
        const stateScript = Ordinal.removeInsciption(this.getStateScript())
        return Utils.buildOutput(stateScript, 1n)
    }

    @method()
    static buildInscribedOutput(
        script: ByteString,
        content: ByteString,
        contentType: ByteString
    ): ByteString {
        const part1 = Ordinal.createInsciption(content, contentType)
        const part2 = Ordinal.removeInsciption(script)
        return Utils.buildOutput(part1 + part2, 1n)
    }

    async inscribe(inscription: Inscription) {
        this.prependNOPScript(Ordinal.create(inscription))
        return this.deploy(1)
    }

    async inscribeText(text: string) {
        return this.inscribe({
            content: text,
            contentType: ContentType.TEXT,
        })
    }

    /**
     *
     * @param content in base64 string format or buffer
     * @param contentType
     * @returns
     */
    async inscribeImage(content: string | Buffer, contentType: string) {
        return this.inscribe({
            content:
                content instanceof Buffer
                    ? content
                    : Buffer.from(content, 'base64'),
            contentType,
        })
    }

    getInscription(): Inscription {
        return Ordinal.getInscription(this.getPrependNOPScript())
    }

    protected override getDefaultTxBuilder(
        methodName: string
    ): MethodCallTxBuilder<this> {
        return async function (
            current: OrdinalNFT,
            options_: MethodCallOptions<OrdinalNFT>,
            ...args
        ): Promise<ContractTransaction> {
            const options = options_ as ORDMethodCallOptions<OrdinalNFT>

            // bsv change address
            const changeAddress = await current.signer.getDefaultAddress()

            const nexts: StatefulNext<SmartContract>[] = []
            const tx = new bsv.Transaction()

            tx.addInput(current.buildContractInput())

            const recipient = options.transfer as NFTReceiver

            if (recipient) {
                if (!(recipient instanceof SmartContract)) {
                    throw new Error(
                        'Transfer option must be of type `SmartContract`.'
                    )
                }

                tx.addOutput(
                    new bsv.Transaction.Output({
                        script: recipient.lockingScript,
                        satoshis: 1,
                    })
                )

                nexts.push({
                    instance: recipient,
                    balance: 1,
                    atOutputIndex: nexts.length,
                })
            }

            tx.change(changeAddress)

            if (options.sequence !== undefined) {
                tx.setInputSequence(0, options.sequence)
            }

            if (options.lockTime) {
                const _sequence =
                    options.sequence !== undefined
                        ? options.sequence
                        : 0xfffffffe
                tx.setInputSequence(0, _sequence) // activate locktime interlock
                tx.setLockTime(options.lockTime)
            }

            return Promise.resolve({
                tx,
                atInputIndex: 0,
                nexts: nexts,
            })
        }
    }

    static override fromUTXO<T extends SmartContract>(
        this: new (...args: any[]) => T,
        utxo: UTXO
    ): T {
        if (utxo.satoshis !== 1) {
            throw new Error('invalid ordinal p2pkh utxo')
        }

        const ins = Ordinal.getInsciptionScript(utxo.script)

        const instance = (
            this as unknown as typeof SmartContract
        ).fromLockingScript(utxo.script, {}, bsv.Script.fromHex(ins)) as T
        instance.from = utxo
        return instance
    }

    static async getLatestInstance<T extends SmartContract>(
        this: new (...args: any[]) => T,
        origin: string
    ): Promise<T> {
        const utxo = await OneSatApis.fetchLatestByOrigin(origin)

        if (utxo === null) {
            throw new Error('no utxo found')
        }

        const a = (this as unknown as typeof SmartContract).fromUTXO(
            utxo
        ) as unknown as T
        return a
    }

    /**
     * recover a `OrdinalNFT` instance from the transaction
     * if the contract contains onchain properties of type `HashedMap` or `HashedSet`
     * it's required to pass all their offchain raw data at this transaction moment
     * @param tx transaction
     * @param atOutputIndex output index of `tx`
     * @param offchainValues the value of offchain properties, the raw data of onchain `HashedMap` and `HashedSet` properties, at this transaction moment
     */
    static override fromTx<T extends SmartContract>(
        this: new (...args: any[]) => T,
        tx: bsv.Transaction,
        atOutputIndex: number,
        offchainValues?: Record<string, any>
    ): T {
        const outputScript = tx.outputs[atOutputIndex].script
        const nopScript = Ordinal.nopScriptFromScript(outputScript)
        const instance = super.fromTx(
            tx,
            atOutputIndex,
            offchainValues,
            nopScript
        )
        return instance as T
    }
}
