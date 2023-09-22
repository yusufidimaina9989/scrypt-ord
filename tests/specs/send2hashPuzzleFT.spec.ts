import { expect, use } from 'chai'
import {
    Addr,
    MethodCallOptions,
    PubKey,
    findSig,
    sha256,
    toByteString,
} from 'scrypt-ts'
import { getDefaultSigner } from '../utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { OrdP2PKH, fromByteString } from '../scrypt-ord'
import { dummyAppendbsv20, dummyPrependbsv20 } from './utils'
import { HashPuzzleFT } from '../contracts/hashPuzzleFT'
use(chaiAsPromised)

describe('Test SmartContract send FT to `HashPuzzleFT`', () => {
    describe('p2pkh with post FT', () => {
        const tick = toByteString('DOGE', true)
        const max = 100000n
        const lim = max / 10n

        const text = 'Hello sCrypt and 1Sat Ordinals'
        const message = toByteString(text, true)
        const hash = sha256(message)

        let recipient: HashPuzzleFT

        const signer = getDefaultSigner()

        before(async () => {
            HashPuzzleFT.loadArtifact()
            recipient = new HashPuzzleFT(tick, max, lim, hash)
            await recipient.connect(signer)
        })

        it('transfer exist FT to a HashPuzzle', async () => {
            const address = await getDefaultSigner().getDefaultAddress()
            const pubkey = await getDefaultSigner().getDefaultPubKey()
            // create p2pkh from a utxo
            const p2pkh = OrdP2PKH.fromP2PKH(
                dummyAppendbsv20(address, fromByteString(tick), 100n)
            )

            await p2pkh.connect(signer)

            const { tx: transferTx } = await p2pkh.methods.unlock(
                (sigResps) => findSig(sigResps, pubkey),
                PubKey(pubkey.toByteString()),
                {
                    transfer: [
                        {
                            instance: recipient,
                            amt: 15n,
                        },
                    ],
                    pubKeyOrAddrToSign: pubkey,
                } as MethodCallOptions<OrdP2PKH>
            )

            console.log('transfer FT: ', transferTx.id)
        })

        it('should pass when transfer FT', async () => {
            const ordAddress = await recipient.signer.getDefaultAddress()
            const call = async () =>
                await recipient.methods.unlock(message, {
                    transfer: [
                        {
                            instance: new OrdP2PKH(
                                Addr(ordAddress.toByteString())
                            ),
                            amt: 15n,
                        },
                    ],
                })
            await expect(call()).not.to.be.rejected
        })
    })

    describe('p2pkh with prepend FT', () => {
        const tick = toByteString('DOGE', true)
        const max = 100000n
        const lim = max / 10n
        const text = 'Hello sCrypt and 1Sat Ordinals'
        const message = toByteString(text, true)
        const hash = sha256(message)

        let recipient: HashPuzzleFT

        const signer = getDefaultSigner()

        before(async () => {
            HashPuzzleFT.loadArtifact()
            recipient = new HashPuzzleFT(tick, max, lim, hash)
            await recipient.connect(signer)
        })

        it('transfer exist NFT to a HashPuzzle', async () => {
            const address = await getDefaultSigner().getDefaultAddress()
            const pubkey = await getDefaultSigner().getDefaultPubKey()
            // create p2pkh from a utxo
            const p2pkh = OrdP2PKH.fromP2PKH(
                dummyPrependbsv20(address, fromByteString(tick), 100n)
            )

            await p2pkh.connect(signer)

            const { tx: transferTx } = await p2pkh.methods.unlock(
                (sigResps) => findSig(sigResps, pubkey),
                PubKey(pubkey.toByteString()),
                {
                    transfer: [
                        {
                            instance: recipient,
                            amt: 9n,
                        },
                    ],
                    pubKeyOrAddrToSign: pubkey,
                } as MethodCallOptions<OrdP2PKH>
            )

            console.log('transfer NFT: ', transferTx.id)
        })

        it('should pass when transfer NFT', async () => {
            const ordAddress = await recipient.signer.getDefaultAddress()
            const call = async () =>
                await recipient.methods.unlock(message, {
                    transfer: [
                        {
                            instance: new OrdP2PKH(
                                Addr(ordAddress.toByteString())
                            ),
                            amt: 9n,
                        },
                    ],
                })
            await expect(call()).not.to.be.rejected
        })
    })
})
