import { Button, ButtonGroup, Image, Modal } from "react-bootstrap";

export function IntroPage() {
    return (
        <header id="header" className="header">
            <div className="container">
                <div className="row">
                    <div className="col-lg-6 col-xl-5">
                        <div className="text-container">
                            <h1 className="h1-large">Find influencers for your products</h1>
                            <p className="p-large">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut dignissim, neque ut ultrices sollicitudin</p>
                            <a className="btn-solid-lg" href="#services">Offered services</a>
                        </div>
                    </div>
                    <div className="col-lg-6 col-xl-7">
                        <div className="image-container">
                            <img className="img-fluid" src="assets/images/header-image.png" alt="alternative" />
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}